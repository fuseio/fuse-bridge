const baseConfig = require('./base.config')

const id = `${baseConfig.id}-initiate-change`

const consensusAbi = require('../abis/Consensus.abi')

module.exports = {
  ...baseConfig.bridgeConfig,
  ...baseConfig.homeConfig,
  eventContractAddress: process.env.CONSENSUS_ADDRESS,
  eventAbi: consensusAbi,
  event: 'InitiateChange',
  queue: 'home',
  name: `watcher-${id}`,
  id
}
