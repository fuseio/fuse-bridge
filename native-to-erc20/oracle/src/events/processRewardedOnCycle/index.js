require('dotenv').config()
const promiseLimit = require('promise-limit')
const { HttpListProviderError } = require('http-list-provider')
const homeBridgeValidatorsABI = require('../../../abis/BridgeValidators.abi')
const foreignBridgeValidatorsABI = require('../../../abis/ForeignBridgeValidators.abi')
const rootLogger = require('../../services/logger')
const { web3Home, web3Foreign } = require('../../services/web3')
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
let foreignValidatorContract = null

function processRewardedOnCycleBuilder (config) {
  return async function processRewardedOnCycle (
    rewardedOnCycleEvents,
    homeBridgeAddress,
    foreignBridgeAddress
  ) {
    const homeBridge = new web3Home.eth.Contract(config.homeBridgeAbi, homeBridgeAddress)
    const foreignBridge = new web3Foreign.eth.Contract(config.foreignBridgeAbi, foreignBridgeAddress)
    const txToSend = []

    if (expectedMessageLength === null) {
      expectedMessageLength = await homeBridge.methods.requiredMessageLength().call()
    }

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

    rootLogger.debug(`Processing ${rewardedOnCycleEvents.length} RewardedOnCycle events`)
    const callbacks = rewardedOnCycleEvents.map(rewardedOnCycle =>
      limit(async () => {
        const value = rewardedOnCycle.returnValues.amount

        const logger = rootLogger.child({
          eventTransactionHash: rewardedOnCycle.transactionHash
        })

        const isForeignValidator = await foreignValidatorContract.methods.isValidator(web3Home.utils.toChecksumAddress(config.validatorAddress)).call()
        if (isForeignValidator) {
          logger.info(
            { value },
            `Processing rewardedOnCycle ${rewardedOnCycle.transactionHash}`
          )

          const message = createMessage({
            recipient: foreignBridgeAddress, // we will mint the tokens and lock them on foreign bridge
            value: value,
            transactionHash: rewardedOnCycle.transactionHash,
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
              logger.info(`Already signed rewardedOnCycle ${rewardedOnCycle.transactionHash}`)
              return
            } else if (e instanceof AlreadyProcessedError) {
              logger.info(
                `rewardedOnCycle ${
                  rewardedOnCycle.transactionHash
                } was already processed by other validators`
              )
              return
            } else {
              logger.error(e, 'Unknown error while processing transaction')
              throw e
            }
          }

          const data = await homeBridge.methods
            .submitSignature(signature.signature, message)
            .encodeABI({ from: config.validatorAddress })

          txToSend.push({
            data,
            gasEstimate,
            transactionReference: rewardedOnCycle.transactionHash,
            to: homeBridgeAddress
          })
        } else {
          logger.info(`Validator is not part of foreign validators, so not responsible for handling RewardedOnCycle ${rewardedOnCycle.transactionHash}`)
        }
      })
    )

    await Promise.all(callbacks)
    return txToSend
  }
}

module.exports = processRewardedOnCycleBuilder
