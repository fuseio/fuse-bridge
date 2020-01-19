require('dotenv').config()
const promiseLimit = require('promise-limit')
const { HttpListProviderError } = require('http-list-provider')
const homeBridgeValidatorsABI = require('../../../abis/Consensus.abi')
const foreignBridgeValidatorsABI = require('../../../abis/ForeignBridgeValidators.abi')
const rootLogger = require('../../services/logger')
const { web3Home, web3Foreign } = require('../../services/web3')
const { createUpgradeBridgeMessage } = require('../../utils/message')
const estimateGas = require('./estimateGas')
const { AlreadyProcessedError, AlreadySignedError, InvalidValidatorError } = require('../../utils/errors')
const { MAX_CONCURRENT_EVENTS } = require('../../utils/constants')

const { VALIDATOR_ADDRESS_PRIVATE_KEY } = process.env

const limit = promiseLimit(MAX_CONCURRENT_EVENTS)

let homeValidatorContract = null
let foreignValidatorContract = null

function processUpgradeBridgeBuilder (config) {
  return async function processUpgradeBridge (
    upgradeBridgeEvents,
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

    rootLogger.debug(`Processing ${upgradeBridgeEvents.length} UpgradeBridge events`)
    const callbacks = upgradeBridgeEvents.map(upgradeBridge =>
      limit(async () => {
        const { contractType, contractAddress } = upgradeBridge.returnValues

        const logger = rootLogger.child({
          eventTransactionHash: upgradeBridge.transactionHash
        })

        const isForeignValidator = await foreignValidatorContract.methods.isValidator(web3Home.utils.toChecksumAddress(config.validatorAddress)).call()
        if (!isForeignValidator) {
          logger.info(`Validator is not part of foreign validators, so not responsible for handling UpgradeBridge ${upgradeBridge.transactionHash}`)
          return
        }

        logger.info(
          { contractType, contractAddress },
          `Processing upgradeBridge ${upgradeBridge.transactionHash}`
        )

        const message = createUpgradeBridgeMessage({
          contractType,
          contractAddress,
          transactionHash: upgradeBridge.transactionHash,
          // see https://github.com/fuseio/fuse-network/blob/master/contracts/ProxyStorage.sol#L17
          bridgeAddress: contractType === 5 ? homeBridgeAddress : foreignBridgeAddress
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
            logger.info(`Already signed upgradeBridge ${upgradeBridge.transactionHash}`)
            return
          } else if (e instanceof AlreadyProcessedError) {
            logger.info(
              `upgradeBridge ${
                upgradeBridge.transactionHash
              } was already processed by other validators`
            )
            return
          } else {
            logger.error(e, 'Unknown error while processing transaction')
            throw e
          }
        }

        const data = await homeBridge.methods
          .submitSignatureOfBridgeUpgrade(signature.signature, message)
          .encodeABI({ from: config.validatorAddress })

        txToSend.push({
          data,
          gasEstimate,
          transactionReference: upgradeBridge.transactionHash,
          to: homeBridgeAddress
        })
      })
    )

    await Promise.all(callbacks)
    return txToSend
  }
}

module.exports = processUpgradeBridgeBuilder
