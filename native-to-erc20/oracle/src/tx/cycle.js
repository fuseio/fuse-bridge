const { getEvents } = require('./web3')
const { web3Home, web3Foreign } = require('../services/web3')
const { sendTx } = require('./sendTx')
const { parseMessage, parseNewSetMessage } = require('../utils/message')
const createRawTx = require('../events/processCollectedSignatures/createRawTx')
const { getNonce, getChainId } = require('./web3')
const GasPrice = require('../services/gasPrice')
const {
  addExtraGas,
  privateKeyToAddress
} = require('../utils/utils')
const { EXTRA_GAS_PERCENTAGE } = require('../utils/constants')

const processInitiateChangeBuilder = require('../events/processInitiateChange')
const foreignBridgeValidatorsABI = require('../../abis/ForeignBridgeValidators.abi')
const rootLogger = require('../services/logger')

const { VALIDATOR_ADDRESS_PRIVATE_KEY } = process.env

const isNewSet = (message) => !!message.newSet
const isNotNewSet = (message) => !isNewSet(message)

const isLengthExpected = (unparsedMessage, expectedMessageLength) => unparsedMessage.length === 2 + 2 * expectedMessageLength

const parseGenericMessage = (unparsedMessage, expectedMessageLength) => {
  if (isLengthExpected(unparsedMessage, expectedMessageLength)) {
    return parseMessage(unparsedMessage)
  } else {
    return parseNewSetMessage(unparsedMessage, expectedMessageLength)
  }
}

const getMessages = async ({ fromBlock, toBlock, isRelayedFilter, isNewSetFilter, event }) => {
  const config = require('../../config/collected-signatures-watcher.config')

  console.log({ fromBlock, toBlock, isRelayedFilter })
  const homeBridge = new web3Home.eth.Contract(config.eventAbi, config.homeBridgeAddress)

  const expectedMessageLength = await homeBridge.methods.requiredMessageLength().call()
  // console.log(config.eventFilter)
  const events = await getEvents({
    contract: homeBridge,
    event: event || config.event,
    fromBlock,
    toBlock,
    filter: config.eventFilter
  })

  if (event === 'SignedForUserRequest' || event === 'InitiateChange') {
    events.forEach(event => console.log(event.returnValues.signer))
    return events
  }

  let messages = []
  for (const event of events) {
    const { messageHash } = event.returnValues
    const unparsedMessage = await homeBridge.methods.message(messageHash).call()
    const message = parseGenericMessage(unparsedMessage, expectedMessageLength)
    // console.log({ unparsedMessage })
    message.event = event
    messages.push(message)
  }

  if (typeof isNewSetFilter !== 'undefined') {
    const messageFilter = isNewSetFilter ? isNewSet : isNotNewSet
    messages = messages.filter(messageFilter)
  }

  console.log({ numberOfMessages: messages.length })

  if (typeof isRelayedFilter === 'undefined') {
    messages.forEach(message => {
      console.log({
        message
      })
    })
    return messages
  }

  const foreignBridge = new web3Foreign.eth.Contract(config.foreignBridgeAbi, config.foreignBridgeAddress)
  const filteredMessages = []
  for (const message of messages) {
    const isRelayed = await foreignBridge.methods.relayedMessages(message.txHash).call()
    if (isRelayed === isRelayedFilter) {
      filteredMessages.push(message)
    }
  }

  console.log({ numberOfFilteredMessages: filteredMessages.length })
  console.log('filtered messages:')
  filteredMessages.forEach(message => {
    console.log({
      message
    })
  })

  return filteredMessages
}

const relayMessages = async ({ fromBlock, toBlock, execute, isNewSetFilter, limit, skip }) => {
  const config = require('../../config/collected-signatures-watcher.config')

  const messages = (await getMessages({ fromBlock, toBlock, isNewSetFilter, isRelayedFilter: false })).slice(0, limit)
  const homeBridge = new web3Home.eth.Contract(config.eventAbi, config.homeBridgeAddress)
  const foreignBridge = new web3Foreign.eth.Contract(config.foreignBridgeAbi, config.foreignBridgeAddress)

  const foreignValidatorContractAddress = await foreignBridge.methods.validatorContract().call()
  const foreignValidatorContract = new web3Foreign.eth.Contract(foreignBridgeValidatorsABI, foreignValidatorContractAddress)

  const VALIDATOR_ADDRESS = privateKeyToAddress(VALIDATOR_ADDRESS_PRIVATE_KEY)
  GasPrice.start('foreign')

  let nonce = await getNonce(web3Foreign, VALIDATOR_ADDRESS)
  const chainId = await getChainId(web3Foreign)

  for (const message of messages) {
    console.log(`Sending the tx for ${message.txHash} with nonce ${nonce}`)
    console.log({ message })
    try {
      debugger
      const job = await createRawTx({ homeBridge, foreignBridge, logger: rootLogger, colSignature: message.event, foreignValidatorContract })
      console.log({ job })

      const gasPrice = GasPrice.getPrice()

      const gasLimit = addExtraGas(job.gasEstimate, EXTRA_GAS_PERCENTAGE)

      const args = {
        chain: 'foreign',
        data: job.data,
        nonce,
        gasPrice,
        amount: '0',
        gasLimit: gasLimit.toString(),
        privateKey: VALIDATOR_ADDRESS_PRIVATE_KEY,
        to: job.to,
        chainId
      }
      console.log({ args })

      if (execute) {
        const txHash = await sendTx({ ...args, web3: web3Foreign }).catch(error => {
          console.log({ error })
        })
        console.log({ txHash })
        nonce++
      }
    } catch (error) {
      if (execute) {
        throw error
      }
    }
  }
}

const sendInitiateChange = async ({ fromBlock, toBlock }) => {
  const config = require('../../config/initiate-change-watcher.config')
  const eventContract = new web3Home.eth.Contract(config.eventAbi, '0x3014ca10b91cb3D0AD85fEf7A3Cb95BCAc9c0f79')
  debugger
  const events = await getEvents({
    contract: eventContract,
    event: config.event,
    fromBlock,
    toBlock,
    filter: config.eventFilter
  })
  // const events = await getMessages({ fromBlock, toBlock, event: 'InitiateChange' })
  console.log({ events })

  const processInitiateChange = processInitiateChangeBuilder(config)

  await processInitiateChange(
    [events[0]],
    config.homeBridgeAddress,
    config.foreignBridgeAddress
  )
}

// call example:
getMessages({ fromBlock: 6000000, toBlock: 6022014, isRelayedFilter: false, isNewSetFilter: false, event: 'SignedForUserRequest' })

// call example:
// relayMessages({ fromBlock: 5999394, toBlock: 6000000, execute: false, isNewSetFilter: false })

// sendInitiateChange({ fromBlock: 5831273, toBlock: 6000000, execute: false })

module.exports = {
  getMessages,
  relayMessages,
  sendInitiateChange
}
