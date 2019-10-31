const baseConfig = require('./base.config')

const id = `${baseConfig.id}-rewarded-on-cycle`

const blockRewardAbi = require('../abis/BlockReward.abi')

module.exports = {
  ...baseConfig.bridgeConfig,
  ...baseConfig.homeConfig,
  eventContractAddress: process.env.BLOCK_REWARD_ADDRESS,
  eventAbi: blockRewardAbi,
  event: 'RewardedOnCycle',
  queue: 'home',
  name: `watcher-${id}`,
  id
}
