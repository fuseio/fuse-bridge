require('dotenv').config()
const promiseLimit = require('promise-limit')
const { HttpListProviderError } = require('http-list-provider')
const homeBridgeValidatorsABI = require('../../../abis/Consensus.abi')
const rootLogger = require('../../services/logger')
const { web3Home } = require('../../services/web3')
const { createMessage } = require('../../utils/message')
const estimateGas = require('./estimateGas')
const {
  AlreadyProcessedError,
  AlreadySignedError,
  InvalidValidatorError
} = require('../../utils/errors')
const { MAX_CONCURRENT_EVENTS } = require('../../utils/constants')

const { VALIDATOR_ADDRESS_PRIVATE_KEY } = process.env

const limit = promiseLimit(MAX_CONCURRENT_EVENTS)

let expectedMessageLength = null
let homeValidatorContract = null

function processSignatureRequestsBuilder (config) {
  return async function processSignatureRequests (
    signatureRequests,
    homeBridgeAddress,
    foreignBridgeAddress
  ) {
    const homeBridge = new web3Home.eth.Contract(config.homeBridgeAbi, homeBridgeAddress)
    const txToSend = []

    if (expectedMessageLength === null) {
      expectedMessageLength = await homeBridge.methods.requiredMessageLength().call()
    }

    if (homeValidatorContract === null) {
      rootLogger.debug('Getting validator contract address')
      const homeValidatorContractAddress = await homeBridge.methods.validatorContract().call()
      rootLogger.debug({ homeValidatorContractAddress }, 'Validator contract address obtained')
      homeValidatorContract = new web3Home.eth.Contract(homeBridgeValidatorsABI, homeValidatorContractAddress)
    }

    rootLogger.debug(`Processing ${signatureRequests.length} SignatureRequest events`)
    const callbacks = signatureRequests.map(signatureRequest =>
      limit(async () => {
        const { recipient, value, data } = signatureRequest.returnValues

        const logger = rootLogger.child({
          eventTransactionHash: signatureRequest.transactionHash
        })

        logger.info({ sender: recipient, value, data }, `Processing signatureRequest ${signatureRequest.transactionHash}`)

        let r = recipient
        if (data && web3Home.utils.isAddress(data)) {
          r = data
        }

        const message = createMessage({
          recipient: r,
          value,
          transactionHash: signatureRequest.transactionHash,
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
            validatorContract: homeValidatorContract,
            signature: signature.signature,
            message,
            address: config.validatorAddress
          })
          logger.debug({ gasEstimate }, 'Gas estimated')
        } catch (e) {
          if (e instanceof HttpListProviderError) {
            throw new Error(
              'RPC Connection Error: submitSignature Gas Estimate cannot be obtained.'
            )
          } else if (e instanceof InvalidValidatorError) {
            logger.fatal({ address: config.validatorAddress }, 'Invalid validator')
            return
          } else if (e instanceof AlreadySignedError) {
            logger.info(`Already signed signatureRequest ${signatureRequest.transactionHash}`)
            return
          } else if (e instanceof AlreadyProcessedError) {
            logger.info(
              `signatureRequest ${
                signatureRequest.transactionHash
              } was already processed by other validators`
            )
            return
          } else {
            logger.error(e, 'Unknown error while processing transaction')
            throw e
          }
        }

        const txData = await homeBridge.methods
          .submitSignature(signature.signature, message)
          .encodeABI({ from: config.validatorAddress })

        txToSend.push({
          data: txData,
          gasEstimate,
          transactionReference: signatureRequest.transactionHash,
          to: homeBridgeAddress
        })
      })
    )

    await Promise.all(callbacks)
    return txToSend
  }
}

module.exports = processSignatureRequestsBuilder
