const Web3 = require('web3')
const { HttpListProviderError } = require('http-list-provider')
const {
  AlreadyProcessedError,
  IncompatibleContractError,
  InvalidValidatorError
} = require('../../utils/errors')
const { parseMessage } = require('../../utils/message')
const logger = require('../../services/logger').child({
  module: 'processCollectedSignatures:estimateGas'
})

const web3 = new Web3()
const { toBN } = Web3.utils

async function estimateGas ({
  foreignBridge,
  validatorContract,
  message,
  numberOfCollectedSignatures,
  v,
  r,
  s,
  expectedMessageLength
}) {
  try {
    debugger
    let gasEstimate, methodName
    if (message && message.length !== 2 + 2 * expectedMessageLength) { /* see ../../utils/message.js#createMessage */
      logger.debug('foreignBridge.methods.executeNewSetSignatures')
      console.log({
        v, r, s, message
      })
      // gasEstimate = 3000000
      gasEstimate = await foreignBridge.methods
        .executeNewSetSignatures(v, r, s, message)
        .estimateGas()
      methodName = 'executeNewSetSignatures'
    } else {
      logger.debug('foreignBridge.methods.executeSignatures')
      gasEstimate = await foreignBridge.methods
        .executeSignatures(v, r, s, message)
        .estimateGas()
      methodName = 'executeSignatures'
    }
    return {
      gasEstimate,
      methodName
    }
  } catch (e) {
    if (e instanceof HttpListProviderError) {
      throw e
    }

    // check if the message was already processed
    logger.debug('Check if the message was already processed')
    const parsedMsg = parseMessage(message)
    const alreadyProcessed = await foreignBridge.methods.relayedMessages(parsedMsg.txHash).call()
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
    const validators = {}
    for (let i = 0; i < v.length; i++) {
      const address = web3.eth.accounts.recover(message, web3.utils.toHex(v[i]), r[i], s[i])
      logger.debug({ address }, 'Check that signature is from a validator')
      const isValidator = await validatorContract.methods.isValidator(address).call()

      if (!isValidator) {
        throw new InvalidValidatorError(`Message signed by ${address} that is not a validator`)
      }
      if (validators[address]) {
        logger.error('validator signed twice', { address })
        throw new Error('Validator signed twice')
      }
      validators[address] = true
    }

    logger.error(e)
    throw new Error('Unknown error while processing message')
  }
}

module.exports = estimateGas
