require('dotenv').config()
const promiseLimit = require('promise-limit')
const { HttpListProviderError } = require('http-list-provider')
const bridgeValidatorsABI = require('../../../abis/BridgeValidators.abi')
const rootLogger = require('../../services/logger')
const { web3Home } = require('../../services/web3')
const { createNewSetMessage } = require('../../utils/message')
const estimateGas = require('./estimateGas')
const {
  AlreadyProcessedError,
  AlreadySignedError,
  InvalidValidatorError
} = require('../../utils/errors')
const { EXIT_CODES, MAX_CONCURRENT_EVENTS } = require('../../utils/constants')

const { VALIDATOR_ADDRESS_PRIVATE_KEY } = process.env

const limit = promiseLimit(MAX_CONCURRENT_EVENTS)

let validatorContract = null

function processInitiateChangeBuilder (config) {
  return async function processInitiateChange (
    initiateChangeEvents,
    homeBridgeAddress,
    foreignBridgeAddress
  ) {
    const homeBridge = new web3Home.eth.Contract(config.homeBridgeAbi, homeBridgeAddress)
    const txToSend = []

    if (validatorContract === null) {
      rootLogger.debug('Getting validator contract address')
      const validatorContractAddress = await homeBridge.methods.validatorContract().call()
      rootLogger.debug({ validatorContractAddress }, 'Validator contract address obtained')

      validatorContract = new web3Home.eth.Contract(bridgeValidatorsABI, validatorContractAddress)
    }

    rootLogger.debug(`Processing ${initiateChangeEvents.length} InitiateChange events`)
    const callbacks = initiateChangeEvents.map(initiateChange =>
      limit(async () => {
        const newSet = initiateChange.returnValues.newSet

        const logger = rootLogger.child({
          eventTransactionHash: initiateChange.transactionHash
        })

        logger.info(
          { newSet },
          `Processing initiateChange ${initiateChange.transactionHash}`
        )

        const message = createNewSetMessage({
          newSet: newSet,
          transactionHash: initiateChange.transactionHash,
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
            validatorContract,
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
            process.exit(EXIT_CODES.INCOMPATIBILITY)
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
