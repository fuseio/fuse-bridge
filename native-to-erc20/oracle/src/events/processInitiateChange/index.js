require('dotenv').config()
const promiseLimit = require('promise-limit')
const { HttpListProviderError } = require('http-list-provider')
const homeBridgeValidatorsABI = require('../../../abis/BridgeValidators.abi')
const foreignBridgeValidatorsABI = require('../../../abis/ForeignBridgeValidators.abi')
const rootLogger = require('../../services/logger')
const { web3Home, web3Foreign } = require('../../services/web3')
const { createNewSetMessage } = require('../../utils/message')
const estimateGas = require('./estimateGas')
const {
  AlreadyProcessedError,
  AlreadySignedError,
  InvalidValidatorError
} = require('../../utils/errors')
const { MAX_CONCURRENT_EVENTS } = require('../../utils/constants')

const { VALIDATOR_ADDRESS_PRIVATE_KEY } = process.env

const limit = promiseLimit(MAX_CONCURRENT_EVENTS)

let homeValidatorContract = null
let foreignValidatorContract = null

function processInitiateChangeBuilder (config) {
  return async function processInitiateChange (
    initiateChangeEvents,
    homeBridgeAddress,
    foreignBridgeAddress
  ) {
    const homeBridge = new web3Home.eth.Contract(config.homeBridgeAbi, homeBridgeAddress)
    const foreignBridge = new web3Foreign.eth.Contract(config.foreignBridgeAbi, foreignBridgeAddress)

    const txToSend = []

    if (homeValidatorContract === null) {
      rootLogger.debug('Getting home validator contract address')
      const homeValidatorContractAddress = await homeBridge.methods.validatorContract().call()
      rootLogger.debug({ homeValidatorContractAddress }, 'Home validator contract address obtained')
      homeValidatorContract = new web3Home.eth.Contract(homeBridgeValidatorsABI, homeValidatorContractAddress)
    }

    if (foreignValidatorContract === null) {
      rootLogger.debug('Getting foreign validator contract address')
      const foreignValidatorContractAddress = await foreignBridge.methods.validatorContract().call()
      rootLogger.debug({ foreignValidatorContractAddress }, 'Foreign validator contract address obtained')
      foreignValidatorContract = new web3Foreign.eth.Contract(foreignBridgeValidatorsABI, foreignValidatorContractAddress)
    }

    rootLogger.debug(`Processing ${initiateChangeEvents.length} InitiateChange events`)
    const callbacks = initiateChangeEvents.map(initiateChange =>
      limit(async () => {
        const { blockNumber } = initiateChange
        const { newSet } = initiateChange.returnValues

        const logger = rootLogger.child({
          eventTransactionHash: initiateChange.transactionHash
        })

        const isForeignValidator = await foreignValidatorContract.methods.isValidator(web3Home.utils.toChecksumAddress(config.validatorAddress)).call()
        if (!isForeignValidator) {
          logger.info(`Validator is not part of foreign validators, so not responsible for handling InitiateChange ${initiateChange.transactionHash}`)
          return
        }

        logger.info(
          { newSet },
          `Processing initiateChange ${initiateChange.transactionHash}`
        )

        const message = createNewSetMessage({
          newSet: newSet,
          transactionHash: initiateChange.transactionHash,
          blockNumber,
          bridgeAddress: foreignBridgeAddress
        })

        const signature = web3Home.eth.accounts.sign(message, `0x${VALIDATOR_ADDRESS_PRIVATE_KEY}`)

        logger.debug('message', message)
        logger.debug('signature', signature)

        let gasEstimate
        try {
          logger.debug('Estimate gas')
          gasEstimate = await estimateGas({
            web3: web3Home,
            homeBridge,
            validatorContract: homeValidatorContract,
            signature: signature.signature,
            message,
            address: config.validatorAddress
          })
          logger.debug({ gasEstimate }, 'Gas estimated')
        } catch (e) {
          if (e instanceof HttpListProviderError) {
            throw new Error(
              'RPC Connection Error: submitSignatureOfMessageWithUnknownLength Gas Estimate cannot be obtained.'
            )
          } else if (e instanceof InvalidValidatorError) {
            logger.fatal({ address: config.validatorAddress }, 'Invalid validator')
            return
          } else if (e instanceof AlreadySignedError) {
            logger.info(`Already signed initiateChange ${initiateChange.transactionHash}`)
            return
          } else if (e instanceof AlreadyProcessedError) {
            logger.info(
              `initiateChange ${
                initiateChange.transactionHash
              } was already processed by other validators`
            )
            return
          } else {
            logger.error(e, 'Unknown error while processing transaction')
            throw e
          }
        }

        const data = await homeBridge.methods
          .submitSignatureOfMessageWithUnknownLength(signature.signature, message)
          .encodeABI({ from: config.validatorAddress })

        txToSend.push({
          data,
          gasEstimate,
          transactionReference: initiateChange.transactionHash,
          to: homeBridgeAddress
        })
      })
    )

    await Promise.all(callbacks)
    return txToSend
  }
}

module.exports = processInitiateChangeBuilder
