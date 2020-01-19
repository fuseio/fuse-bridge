const Web3 = require('web3')
const { HttpListProviderError } = require('http-list-provider')
const {
  AlreadyProcessedError,
  IncompatibleContractError,
  InvalidValidatorError
} = require('../../utils/errors')
const { parseMessage, parseNewSetMessage, parseUpgradeBridgeMessage } = require('../../utils/message')
const logger = require('../../services/logger').child({
  module: 'processCollectedSignatures:estimateGas'
})

const web3 = new Web3()
const { toBN } = Web3.utils

let gasEstimate, methodName, bridge, parsedMsg, validatorContract

async function estimateGas ({
  homeBridge,
  foreignBridge,
  homeValidatorContract,
  foreignValidatorContract,
  message,
  numberOfCollectedSignatures,
  sigType,
  v,
  r,
  s,
  expectedMessageLength
}) {
  try {
    bridge = foreignBridge
    validatorContract = foreignValidatorContract
    switch (sigType) {
      case 0:
        logger.debug('foreignBridge.methods.executeSignatures')
        parsedMsg = parseMessage(message)
        gasEstimate = await foreignBridge.methods
          .executeSignatures(v, r, s, message)
          .estimateGas()
        methodName = 'executeSignatures'
        break
      case 1:
        logger.debug('foreignBridge.methods.executeNewSetSignatures')
        parsedMsg = parseNewSetMessage(message)
        gasEstimate = await foreignBridge.methods
          .executeNewSetSignatures(v, r, s, message)
          .estimateGas()
        methodName = 'executeNewSetSignatures'
        break
      case 2:
        logger.debug('foreignBridge.methods.executeUpgradeBridgeSignatures')
        parsedMsg = parseUpgradeBridgeMessage(message)
        if (parsedMsg.bridgeAddress === homeBridge) {
          gasEstimate = await homeBridge.methods
            .executeUpgradeBridgeSignatures(v, r, s, message)
            .estimateGas()
          methodName = 'executeUpgradeBridgeSignatures'
          bridge = homeBridge
          validatorContract = homeValidatorContract
        } else if (parsedMsg.bridgeAddress === foreignBridge) {
          gasEstimate = await foreignBridge.methods
            .executeUpgradeBridgeSignatures(v, r, s, message)
            .estimateGas()
          methodName = 'executeUpgradeBridgeSignatures'
        }
        break
    }
    return {
      gasEstimate,
      methodName,
      bridge
    }
  } catch (e) {
    if (e instanceof HttpListProviderError) {
      throw e
    }

    // check if the message was already processed
    logger.debug('Check if the message was already processed')
    const alreadyProcessed = await bridge.methods.relayedMessages(parsedMsg.txHash).call()
    if (alreadyProcessed) {
      throw new AlreadyProcessedError()
    }

    // check if the number of signatures is enough
    logger.debug('Check if number of signatures is enough')
    const requiredSignatures = await validatorContract.methods.requiredSignatures().call()
    if (toBN(requiredSignatures).gt(toBN(numberOfCollectedSignatures))) {
      throw new IncompatibleContractError('The number of collected signatures does not match')
    }

    // check if all the signatures were made by validators
    for (let i = 0; i < v.length; i++) {
      const address = web3.eth.accounts.recover(message, web3.utils.toHex(v[i]), r[i], s[i])
      logger.debug({ address }, 'Check that signature is from a validator')
      const isValidator = await validatorContract.methods.isValidator(address).call()

      if (!isValidator) {
        throw new InvalidValidatorError(`Message signed by ${address} that is not a validator`)
      }
    }

    logger.error(e)
    throw new Error('Unknown error while processing message')
  }
}

module.exports = estimateGas
