require('dotenv').config()
const promiseLimit = require('promise-limit')
const { HttpListProviderError } = require('http-list-provider')
const homeBridgeValidatorsABI = require('../../../abis/Consensus.abi')
const foreignBridgeValidatorsABI = require('../../../abis/ForeignBridgeValidators.abi')
const rootLogger = require('../../services/logger')
const { web3Home, web3Foreign } = require('../../services/web3')
const { getBlockNumber } = require('../../tx/web3')
const { signatureToVRS } = require('../../utils/message')
const estimateGas = require('./estimateGas')
const {
  AlreadyProcessedError,
  IncompatibleContractError,
  InvalidValidatorError
} = require('../../utils/errors')
const { MAX_CONCURRENT_EVENTS, MAX_BLOCKS_TO_ALLOW_AUTHORITY_RESPONSIBLE_TO_RELAY } = require('../../utils/constants')

const limit = promiseLimit(MAX_CONCURRENT_EVENTS)

let homeValidatorContract = null
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

    if (homeValidatorContract === null) {
      rootLogger.debug('Getting home validator contract address')
      const homeValidatorContractAddress = await homeBridge.methods.validatorContract().call()
      rootLogger.debug({ homeValidatorContractAddress }, 'Home validator contract address obtained')
      homeValidatorContract = new web3Home.eth.Contract(homeBridgeValidatorsABI, homeValidatorContractAddress)
    }

    if (foreignValidatorContract === null) {
      rootLogger.debug('Getting validator contract address')
      const foreignValidatorContractAddress = await foreignBridge.methods.validatorContract().call()
      rootLogger.debug({ foreignValidatorContractAddress }, 'Validator contract address obtained')
      foreignValidatorContract = new web3Foreign.eth.Contract(foreignBridgeValidatorsABI, foreignValidatorContractAddress)
    }

    rootLogger.debug(`Processing ${signatures.length} CollectedSignatures events`)
    const callbacks = signatures.map(colSignature =>
      limit(async () => {
        const { blockNumber } = colSignature
        const { authorityResponsibleForRelay, messageHash, numberOfCollectedSignatures, sigType } = colSignature.returnValues

        const logger = rootLogger.child({
          eventTransactionHash: colSignature.transactionHash
        })

        let runProcess = true
        if (authorityResponsibleForRelay !== web3Home.utils.toChecksumAddress(config.validatorAddress)) {
          const currentBlockNumber = await getBlockNumber(web3Home)
          if (currentBlockNumber > blockNumber + MAX_BLOCKS_TO_ALLOW_AUTHORITY_RESPONSIBLE_TO_RELAY) {
            const validators = await homeValidatorContract.methods.getValidators().call()
            const i = (currentBlockNumber - blockNumber) % validators.length % MAX_BLOCKS_TO_ALLOW_AUTHORITY_RESPONSIBLE_TO_RELAY
            const nextAuthorityTryingToRelay = validators[i]
            if (nextAuthorityTryingToRelay === web3Home.utils.toChecksumAddress(config.validatorAddress)) {
              logger.info(`Validator not responsible for relaying CollectedSignatures ${colSignature.transactionHash} but is next in line after waiting for ${authorityResponsibleForRelay} too long`)
            } else {
              logger.info(`Validator not responsible for relaying CollectedSignatures ${colSignature.transactionHash}, waiting for ${authorityResponsibleForRelay} too long, next in line is ${nextAuthorityTryingToRelay}`)
              runProcess = false
            }
          } else {
            logger.info(`Validator not responsible for relaying CollectedSignatures ${colSignature.transactionHash}, waiting for ${authorityResponsibleForRelay}`)
            runProcess = false
          }
        }

        if (runProcess) {
          logger.info(`Processing CollectedSignatures ${colSignature.transactionHash}`)
          const message = await homeBridge.methods.message(messageHash).call()
          const expectedMessageLength = await homeBridge.methods.requiredMessageLength().call()

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

          let gasEstimate, methodName, bridge
          try {
            logger.debug('Estimate gas')
            const result = await estimateGas({
              homeBridge,
              foreignBridge,
              foreignValidatorContract,
              homeValidatorContract,
              message,
              numberOfCollectedSignatures,
              sigType,
              v,
              r,
              s,
              expectedMessageLength
            })
            logger.info({ result }, 'Gas estimated')
            gasEstimate = result.gasEstimate
            methodName = result.methodName
            bridge = result.bridge
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
          const data = await bridge.methods[methodName](v, r, s, message).encodeABI()
          txToSend.push({
            data,
            gasEstimate,
            transactionReference: colSignature.transactionHash,
            to: bridge.address
          })
        }
      })
    )

    await Promise.all(callbacks)

    return txToSend
  }
}

module.exports = processCollectedSignaturesBuilder
