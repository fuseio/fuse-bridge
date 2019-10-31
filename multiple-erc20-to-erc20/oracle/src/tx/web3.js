const logger = require('../services/logger').child({
  module: 'web3'
})

async function getNonce (web3, address) {
  try {
    logger.debug({ address }, 'Getting transaction count')
    const transactionCount = await web3.eth.getTransactionCount(address)
    logger.debug({ address, transactionCount }, 'Transaction count obtained')
    return transactionCount
  } catch (e) {
    throw new Error('Nonce cannot be obtained')
  }
}

async function getBlockNumber (web3) {
  try {
    logger.debug('Getting block number')
    const blockNumber = await web3.eth.getBlockNumber()
    logger.debug({ blockNumber }, 'Block number obtained')
    return blockNumber
  } catch (e) {
    throw new Error('Block Number cannot be obtained')
  }
}

async function getChainId (web3) {
  try {
    logger.debug('Getting chain id')
    const chainId = await web3.eth.net.getId()
    logger.debug({ chainId }, 'Chain id obtained')
    return chainId
  } catch (e) {
    throw new Error('Chain Id cannot be obtained')
  }
}

module.exports = {
  getNonce,
  getBlockNumber,
  getChainId
}
