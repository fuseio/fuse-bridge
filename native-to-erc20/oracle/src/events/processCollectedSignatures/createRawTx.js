const { HttpListProviderError } = require('http-list-provider')
const { signatureToVRS } = require('../../utils/message')
const estimateGas = require('./estimateGas')
const {
  AlreadyProcessedError,
  IncompatibleContractError,
  InvalidValidatorError
} = require('../../utils/errors')

const createRawTx = async ({ homeBridge, foreignBridge, logger, colSignature, foreignValidatorContract }) => {
  const { messageHash, NumberOfCollectedSignatures } = colSignature.returnValues

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
  return {
    data,
    gasEstimate,
    transactionReference: colSignature.transactionHash,
    to: foreignBridge.options.address
  }
}

module.exports = createRawTx
