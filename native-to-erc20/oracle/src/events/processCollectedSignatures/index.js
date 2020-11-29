require('dotenv').config()
const promiseLimit = require('promise-limit')
const { HttpListProviderError } = require('http-list-provider')
const homeBridgeValidatorsABI = require('../../../abis/Consensus.abi')
const foreignBridgeValidatorsABI = require('../../../abis/ForeignBridgeValidators.abi')
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
const path = require('path')

// const func = async () => {
//   const config = require(path.join('../../../config/', process.argv[2]))
//   console.log({ web3Foreign })
//   const foreignBridgeAddress = '0x3014ca10b91cb3D0AD85fEf7A3Cb95BCAc9c0f79'
//   const foreignBridge = new web3Foreign.eth.Contract(config.foreignBridgeAbi, foreignBridgeAddress)
//   const foreignValidatorContractAddress = await foreignBridge.methods.validatorContract().call()
//   rootLogger.debug({ foreignValidatorContractAddress }, 'Validator contract address obtained')
//   const foreignValidatorContract = new web3Foreign.eth.Contract(foreignBridgeValidatorsABI, foreignValidatorContractAddress)

//   console.log(await foreignValidatorContract.methods.validators().call())

//   const sig = '0xed157c39b80281741e7d4075655f25b11a9182f12d90878a1ba9bfed111c899620b74dc25ba2f581be753e11673413eb90f1f08285c2100d8e16c6799818c77d1b'
//   const { v, r, s } = signatureToVRS(sig)
//   const add = web3Home.eth.accounts.recover(s, web3Home.utils.toHex(v), r, s)
//   console.log({ add })
// }

// func()

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

    // TODO: take only the signatures of foreign bridge validators
    rootLogger.debug(`Processing ${signatures.length} CollectedSignatures events`)
    const callbacks = signatures.map(colSignature =>
      limit(async () => {
        const { messageHash, NumberOfCollectedSignatures } = colSignature.returnValues

        const logger = rootLogger.child({
          eventTransactionHash: colSignature.transactionHash
        })

        const isForeignValidator = await foreignValidatorContract.methods.isValidator(web3Home.utils.toChecksumAddress(config.validatorAddress)).call()

        if (isForeignValidator) {
          logger.info(`Processing CollectedSignatures ${colSignature.transactionHash}`)
          const foreignValidators = await foreignValidatorContract.methods.validators().call()
          const numberOfRequiredSignatures = await foreignValidatorContract.methods.requiredSignatures().call()

          const message = await homeBridge.methods.message(messageHash).call()
          const expectedMessageLength = await homeBridge.methods.requiredMessageLength().call()

          const requiredSignatures = []
          requiredSignatures.length = numberOfRequiredSignatures
          requiredSignatures.fill(0)

          const [v, r, s] = [[], [], []]
          logger.debug('Getting message signatures')
          const signaturePromises = requiredSignatures.map(async (el, index) => {
            logger.debug({ index }, 'Getting message signature')
            const signature = await homeBridge.methods.signature(messageHash, index).call()
            const recover = signatureToVRS(signature)
            const validatorAddress = web3Home.eth.accounts.recover(signature, web3Home.utils.toHex(recover.v), recover.r, recover.s)
            if (foreignValidators.includes(validatorAddress)) {
              v.push(recover.v)
              r.push(recover.r)
              s.push(recover.s)
            }
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
