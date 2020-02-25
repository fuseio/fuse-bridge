require('dotenv').config()
const promiseLimit = require('promise-limit')
const { HttpListProviderError } = require('http-list-provider')
const bridgeValidatorsABI = require('../../../abis/BridgeValidators.abi')
const basicTokenABI = require('../../../abis/BasicToken.abi')
const rootLogger = require('../../services/logger')
const { web3Home, web3Foreign } = require('../../services/web3')
const {
  AlreadyProcessedError,
  AlreadySignedError,
  InvalidValidatorError
} = require('../../utils/errors')
const { EXIT_CODES, MAX_CONCURRENT_EVENTS } = require('../../utils/constants')
const { replaceLogsWithEvents } = require('../../utils/utils')
const estimateGas = require('./estimateGas')

const limit = promiseLimit(MAX_CONCURRENT_EVENTS)

let validatorContract = null

function processTransfersBuilder (config) {
  return async function processTransfers (transferEvents, deployedBridges) {
    const txToSend = []
    rootLogger.debug(`Starting to process ${transferEvents.length} Transfer events`)

    const uniqueTransferEvents = {}
    transferEvents.forEach(t => {
      if (uniqueTransferEvents[t.txHash]) {
        const tx = uniqueTransferEvents[t.txHash]
        if (tx.txHash === t.txHash && tx.from === t.from && tx.to === t.to && tx.value === t.value && t.data) {
          uniqueTransferEvents[t.txHash] = t
        }
      } else {
        uniqueTransferEvents[t.txHash] = t
      }
    })
    const transfers = Object.values(uniqueTransferEvents)
    rootLogger.debug(`Processing ${transfers.length} Transfer events (after filter)`)
    const callbacks = transfers.map(transfer =>
      limit(async () => {
        const { from, value, data, txHash, tokenAddress, to } = transfer

        const logger = rootLogger.child({
          eventTransactionHash: txHash
        })

        logger.info({ from, value, data, tokenAddress, to }, `Processing transfer ${txHash}`)

        const homeBridgeAddress = deployedBridges.filter(d => d.foreignBridge === to).map(d => d.homeBridge)[0]
        if (!homeBridgeAddress) {
          logger.warn(`Skipping transfer ${txHash} - could not find homeBridgeAddress for foreingToken: ${tokenAddress}, foreignBridge: ${to}`)
          return
        }
        const homeBridge = new web3Home.eth.Contract(config.homeBridgeAbi, homeBridgeAddress)

        if (validatorContract === null) {
          rootLogger.debug('Getting validator contract address')
          const validatorContractAddress = await homeBridge.methods.validatorContract().call()
          rootLogger.debug({ validatorContractAddress }, 'Validator contract address obtained')

          validatorContract = new web3Home.eth.Contract(bridgeValidatorsABI, validatorContractAddress)
        }

        let recipient
        if (data && web3Foreign.utils.isAddress(data)) {
          recipient = data
        } else {
          const receipt = await web3Foreign.eth.getTransactionReceipt(txHash)
          logger.debug('receipt', receipt)
          const { events } = replaceLogsWithEvents(receipt, new web3Foreign.eth.Contract(basicTokenABI))
          logger.debug('events', events)
          Array.isArray(events.Transfer) && events.Transfer.forEach(ev => {
            const d = ev.returnValues.data
            if (d && web3Home.utils.isAddress(d)) {
              recipient = d
            }
          })
        }
        recipient = recipient || from
        logger.debug('recipient', recipient)

        let gasEstimate
        try {
          logger.debug('Estimate gas')
          gasEstimate = await estimateGas({
            web3: web3Home,
            homeBridge,
            validatorContract,
            recipient: recipient,
            value,
            txHash: txHash,
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
            process.exit(EXIT_CODES.INCOMPATIBILITY)
          } else if (e instanceof AlreadySignedError) {
            logger.info(`Already signed transfer ${txHash}`)
            return
          } else if (e instanceof AlreadyProcessedError) {
            logger.info(
              `transfer ${txHash} was already processed by other validators`
            )
            return
          } else {
            logger.error(e, 'Unknown error while processing transaction')
            throw e
          }
        }

        const txData = await homeBridge.methods
          .executeAffirmation(recipient, value, txHash)
          .encodeABI({ from: config.validatorAddress })

        txToSend.push({
          data: txData,
          gasEstimate,
          transactionReference: txHash,
          to: homeBridgeAddress
        })
      })
    )

    await Promise.all(callbacks)
    return txToSend
  }
}

module.exports = processTransfersBuilder
