require('dotenv').config()
const promiseLimit = require('promise-limit')
const { HttpListProviderError } = require('http-list-provider')
const bridgeValidatorsABI = require('../../../abis/BridgeValidators.abi')
const rootLogger = require('../../services/logger')
const { web3Home } = require('../../services/web3')
const { createMessage } = require('../../utils/message')
const estimateGas = require('./estimateGas')
const {
  AlreadyProcessedError,
  AlreadySignedError,
  InvalidValidatorError
} = require('../../utils/errors')
const { EXIT_CODES, MAX_CONCURRENT_EVENTS } = require('../../utils/constants')

const { VALIDATOR_ADDRESS_PRIVATE_KEY } = process.env

const limit = promiseLimit(MAX_CONCURRENT_EVENTS)

let expectedMessageLength = null
let validatorContract = null

function processSignatureRequestsBuilder (config) {
  return async function processSignatureRequests (
    signatureRequests,
    deployedBridges
  ) {
    const txToSend = []
    rootLogger.debug(`Processing ${signatureRequests.length} SignatureRequest events`)
    const callbacks = signatureRequests.map(signatureRequest =>
      limit(async () => {
        const { recipient, value, data, bridgeAddress, txHash } = signatureRequest

        const logger = rootLogger.child({
          eventTransactionHash: txHash
        })

        logger.info({ sender: recipient, value, data }, `Processing signatureRequest ${txHash}`)

        const homeBridgeAddress = bridgeAddress
        const foreignBridgeAddress = deployedBridges.filter(d => d.homeBridge === homeBridgeAddress).map(d => d.foreignBridge)[0]

        const homeBridge = new web3Home.eth.Contract(config.homeBridgeAbi, homeBridgeAddress)

        if (expectedMessageLength === null) {
          expectedMessageLength = await homeBridge.methods.requiredMessageLength().call()
        }

        if (validatorContract === null) {
          rootLogger.debug('Getting validator contract address')
          const validatorContractAddress = await homeBridge.methods.validatorContract().call()
          rootLogger.debug({ validatorContractAddress }, 'Validator contract address obtained')
          validatorContract = new web3Home.eth.Contract(bridgeValidatorsABI, validatorContractAddress)
        }

        let r = recipient
        if (data && web3Home.utils.isAddress(data)) {
          r = data
        }

        const message = createMessage({
          recipient: r,
          value,
          transactionHash: txHash,
          bridgeAddress: foreignBridgeAddress,
          expectedMessageLength
        })

        const signature = web3Home.eth.accounts.sign(message, `0x${VALIDATOR_ADDRESS_PRIVATE_KEY}`)

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
            throw new Error('RPC Connection Error: submitSignature Gas Estimate cannot be obtained.')
          } else if (e instanceof InvalidValidatorError) {
            logger.fatal({ address: config.validatorAddress }, 'Invalid validator')
            process.exit(EXIT_CODES.INCOMPATIBILITY)
          } else if (e instanceof AlreadySignedError) {
            logger.info(`Already signed signatureRequest ${txHash}`)
            return
          } else if (e instanceof AlreadyProcessedError) {
            logger.info(`signatureRequest ${txHash} was already processed by other validators`)
            return
          } else {
            logger.error(e, `Unknown error while processing transaction ${txHash}`)
            return
          }
        }

        const txData = await homeBridge.methods
          .submitSignature(signature.signature, message)
          .encodeABI({ from: config.validatorAddress })

        txToSend.push({
          data: txData,
          gasEstimate,
          transactionReference: txHash,
          to: homeBridgeAddress
        })
      })
    )

    await Promise.all(callbacks)
    return txToSend
  }
}

module.exports = processSignatureRequestsBuilder
