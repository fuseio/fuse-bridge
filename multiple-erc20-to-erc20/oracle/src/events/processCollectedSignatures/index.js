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

const limit = promiseLimit(MAX_CONCURRENT_EVENTS)

let validatorContract = null

function processCollectedSignaturesBuilder (config) {
  return async function processCollectedSignatures (
    signatures,
    deployedBridges
  ) {
    const txToSend = []
    rootLogger.debug(`Processing ${signatures.length} CollectedSignatures events`)
    const callbacks = signatures.map(sig =>
      limit(async () => {
        const { authorityResponsibleForRelay, messageHash, numberOfCollectedSignatures, bridgeAddress, txHash } = sig

        const logger = rootLogger.child({
          eventTransactionHash: txHash
        })

        if (web3Home.utils.toChecksumAddress(authorityResponsibleForRelay) === web3Home.utils.toChecksumAddress(config.validatorAddress)) {
          logger.info(`Processing CollectedSignatures ${txHash}`)

          const homeBridgeAddress = bridgeAddress
          const foreignBridgeAddress = deployedBridges.filter(d => d.homeBridge === homeBridgeAddress).map(d => d.foreignBridge)[0]

          const homeBridge = new web3Home.eth.Contract(config.homeBridgeAbi, homeBridgeAddress)
          const foreignBridge = new web3Foreign.eth.Contract(config.foreignBridgeAbi, foreignBridgeAddress)

          if (validatorContract === null) {
            rootLogger.debug('Getting validator contract address')
            const validatorContractAddress = await foreignBridge.methods.validatorContract().call()
            rootLogger.debug({ validatorContractAddress }, 'Validator contract address obtained')
            validatorContract = new web3Foreign.eth.Contract(bridgeValidatorsABI, validatorContractAddress)
          }

          const message = await homeBridge.methods.message(messageHash).call()

          const requiredSignatures = []
          requiredSignatures.length = numberOfCollectedSignatures
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

          let gasEstimate
          try {
            logger.debug('Estimate gas')
            gasEstimate = await estimateGas({
              foreignBridge,
              validatorContract,
              v,
              r,
              s,
              message,
              numberOfCollectedSignatures
            })
            logger.debug({ gasEstimate }, 'Gas estimated')
          } catch (e) {
            if (e instanceof HttpListProviderError) {
              throw new Error('RPC Connection Error: submitSignature Gas Estimate cannot be obtained.')
            } else if (e instanceof AlreadyProcessedError) {
              logger.info(`Already processed CollectedSignatures ${txHash}`)
              return
            } else if (e instanceof IncompatibleContractError || e instanceof InvalidValidatorError) {
              logger.error(`The message couldn't be processed; skipping: ${e.message}`)
              return
            } else {
              logger.error(e, `Unknown error while processing transaction ${txHash}`)
              return
            }
          }
          const data = await foreignBridge.methods.executeSignatures(v, r, s, message).encodeABI()
          txToSend.push({
            data,
            gasEstimate,
            transactionReference: txHash,
            to: foreignBridgeAddress
          })
        } else {
          logger.info(`Validator not responsible for relaying CollectedSignatures ${txHash}`)
        }
      })
    )

    await Promise.all(callbacks)

    return txToSend
  }
}

module.exports = processCollectedSignaturesBuilder
