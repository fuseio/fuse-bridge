const { getEvents } = require('../tx/web3')
const config = require('../../config/collected-signatures-watcher.config')
const { web3Home, web3Foreign } = require('../services/web3')
const { parseMessage } = require('../utils/message')

const getMissedCycles = async () => {

}

const getCollectedSignatures = async ({ fromBlock, toBlock }) => {

  const homeBridge = new web3Home.eth.Contract(config.eventAbi, config.homeBridgeAddress)
  const foreignBridge = new web3Foreign.eth.Contract(config.foreignBridgeAbi, config.foreignBridgeAddress)


  // config.homeBridgeAddress,
  // config.foreignBridgeAddress,
  const events = await getEvents({
    contract: homeBridge,
    event: config.event,
    fromBlock,
    toBlock,
    filter: config.eventFilter
  })
  console.log(events.length)
  for (const event of events) {
    const { messageHash } = event.returnValues
    const message = parseMessage(await homeBridge.methods.message(messageHash).call())
    const isRelayed = await foreignBridge.methods.relayedMessages(message.txHash).call()
    console.log(isRelayed)
    if (!isRelayed) {
      const { blockNumber, transactionHash } = event
      console.log({ blockNumber, transactionHash })
    }
  }

  // const contract
  return events
}

getCollectedSignatures({ fromBlock: 4850326, toBlock: 5050326 })

module.exports = {
  getMissedCycles,
  getCollectedSignatures
}
