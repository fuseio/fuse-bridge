require('dotenv').config()
const rootLogger = require('../../services/logger')
const { web3Home } = require('../../services/web3')
const promiseLimit = require('promise-limit')
const homeBridgeValidatorsABI = require('../../../abis/Consensus.abi')
const { MAX_CONCURRENT_EVENTS } = require('../../utils/constants')
const estimateGas = require('./estimateGas')
const {
  AlreadyProcessedError,
  AlreadySignedError,
  InvalidValidatorError
} = require('../../utils/errors')
const { HttpListProviderError } = require('http-list-provider')

const limit = promiseLimit(MAX_CONCURRENT_EVENTS)

let homeValidatorContract = null

function processAffirmationRequestsBuilder (config) {
  const homeBridge = new web3Home.eth.Contract(config.homeBridgeAbi, config.homeBridgeAddress)

  return async function processAffirmationRequests (affirmationRequests) {
    const txToSend = []

    if (homeValidatorContract === null) {
      rootLogger.debug('Getting validator contract address')
      const homeValidatorContractAddress = await homeBridge.methods.validatorContract().call()
      rootLogger.debug({ homeValidatorContractAddress }, 'Validator contract address obtained')
      homeValidatorContract = new web3Home.eth.Contract(homeBridgeValidatorsABI, homeValidatorContractAddress)
    }

    rootLogger.debug(`Processing ${affirmationRequests.length} AffirmationRequest events`)
    const callbacks = affirmationRequests.map(affirmationRequest =>
      limit(async () => {
        const { recipient, value } = affirmationRequest.returnValues

        const logger = rootLogger.child({
          eventTransactionHash: affirmationRequest.transactionHash
        })

        logger.info(
          { sender: recipient, value },
          `Processing affirmationRequest ${affirmationRequest.transactionHash}`
        )

        let gasEstimate
        try {
          logger.debug('Estimate gas')
          gasEstimate = await estimateGas({
            web3: web3Home,
            homeBridge,
            validatorContract: homeValidatorContract,
            recipient,
            value,
            txHash: affirmationRequest.transactionHash,
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
            logger.info(`Already signed affirmationRequest ${affirmationRequest.transactionHash}`)
            return
          } else if (e instanceof AlreadyProcessedError) {
            logger.info(
              `affirmationRequest ${
                affirmationRequest.transactionHash
              } was already processed by other validators`
            )
            return
          } else {
            logger.error(e, 'Unknown error while processing transaction')
            throw e
          }
        }

        const data = await homeBridge.methods
          .executeAffirmation(recipient, value, affirmationRequest.transactionHash)
          .encodeABI({ from: config.validatorAddress })

        txToSend.push({
          data,
          gasEstimate,
          transactionReference: affirmationRequest.transactionHash,
          to: config.homeBridgeAddress
        })
      })
    )

    await Promise.all(callbacks)
    return txToSend
  }
}

module.exports = processAffirmationRequestsBuilder
