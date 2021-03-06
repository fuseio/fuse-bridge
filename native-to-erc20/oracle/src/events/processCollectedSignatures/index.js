require('dotenv').config()
const promiseLimit = require('promise-limit')
const { HttpListProviderError } = require('http-list-provider')
const bridgeValidatorsABI = require('../../../abis/BridgeValidators.abi')
const rootLogger = require('../../services/logger')
const { web3Home, web3Foreign } = require('../../services/web3')
const { signatureToVRS } = require('../../utils/message')
const estimateGas = require('./estimateGas')
const {
  AlreadyProcessedError,
  IncompatibleContractError,
  InvalidValidatorError
} = require('../../utils/errors')
const { MAX_CONCURRENT_EVENTS } = require('../../utils/constants')
const { FOREIGN_VALIDATOR_RESPONSIBLE_TO_RELAY } = process.env
const limit = promiseLimit(MAX_CONCURRENT_EVENTS)

let foreignValidatorContract = null

function processCollectedSignaturesBuilder (config) {
  return async function processCollectedSignatures (
    signatures,
    homeBridgeAddress,
    foreignBridgeAddress
  ) {
    const homeBridge = new web3Home.eth.Contract(config.homeBridgeAbi, homeBridgeAddress)
    const foreignBridge = new web3Foreign.eth.Contract(config.foreignBridgeAbi, foreignBridgeAddress)

    const txToSend = []

    if (foreignValidatorContract === null) {
      rootLogger.debug('Getting validator contract address')
      const foreignValidatorContractAddress = await foreignBridge.methods.validatorContract().call()
      rootLogger.debug({ foreignValidatorContractAddress }, 'Validator contract address obtained')
      foreignValidatorContract = new web3Foreign.eth.Contract(bridgeValidatorsABI, foreignValidatorContractAddress)
    }

    const isResponsibleForRelay = () => {
      return FOREIGN_VALIDATOR_RESPONSIBLE_TO_RELAY && foreignValidatorContract.methods.isValidator(web3Home.utils.toChecksumAddress(config.validatorAddress)).call()
    }

    // TODO: take only the signatures of foreign bridge validators
    rootLogger.debug(`Processing ${signatures.length} CollectedSignatures events`)
    const callbacks = signatures.map(colSignature =>
      limit(async () => {
        const { messageHash, NumberOfCollectedSignatures } = colSignature.returnValues

        const logger = rootLogger.child({
          eventTransactionHash: colSignature.transactionHash
        })

        const responsibleForRelay = await isResponsibleForRelay()

        if (responsibleForRelay) {
          logger.info(`Processing CollectedSignatures ${colSignature.transactionHash}`)
          const message = await homeBridge.methods.message(messageHash).call()
          const expectedMessageLength = await homeBridge.methods.requiredMessageLength().call()

          const requiredSignatures = []
          requiredSignatures.length = NumberOfCollectedSignatures
          requiredSignatures.fill(0)

          const [v, r, s] = [[], [], []]
          logger.debug('Getting message signatures')
          const signaturePromises = requiredSignatures.map(async (el, index) => {
            logger.debug({ index }, 'Getting message signature')
            const signature = await homeBridge.methods.signature(messageHash, index).call()
            const recover = signatureToVRS(signature)
            v.push(recover.v)
            r.push(recover.r)
            s.push(recover.s)
          })

          await Promise.all(signaturePromises)

          let gasEstimate, methodName
          try {
            logger.debug('Estimate gas')
            const result = await estimateGas({
              foreignBridge,
              validatorContract: foreignValidatorContract,
              v,
              r,
              s,
              message,
              numberOfCollectedSignatures: NumberOfCollectedSignatures,
              expectedMessageLength
            })
            logger.info({ result }, 'Gas estimated')
            gasEstimate = result.gasEstimate
            methodName = result.methodName
          } catch (e) {
            if (e instanceof HttpListProviderError) {
              throw new Error(
                'RPC Connection Error: submitSignature Gas Estimate cannot be obtained.'
              )
            } else if (e instanceof AlreadyProcessedError) {
              logger.info(`Already processed CollectedSignatures ${colSignature.transactionHash}`)
              return
            } else if (
              e instanceof IncompatibleContractError ||
              e instanceof InvalidValidatorError
            ) {
              logger.error(`The message couldn't be processed; skipping: ${e.message}`)
              return
            } else {
              logger.error(e, 'Unknown error while processing transaction')
              throw e
            }
          }
          const data = await foreignBridge.methods[methodName](v, r, s, message).encodeABI()
          txToSend.push({
            data,
            gasEstimate,
            transactionReference: colSignature.transactionHash,
            to: foreignBridgeAddress
          })
        }
      })
    )

    await Promise.all(callbacks)

    return txToSend
  }
}

module.exports = processCollectedSignaturesBuilder
