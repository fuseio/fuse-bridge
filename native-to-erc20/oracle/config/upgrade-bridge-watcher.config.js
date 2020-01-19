const baseConfig = require('./base.config')

const id = `${baseConfig.id}-initiate-change`

const proxyStorageAbi = require('../abis/ProxyStorage.abi')

module.exports = {
  ...baseConfig.bridgeConfig,
  ...baseConfig.homeConfig,
  eventContractAddress: process.env.PROXY_STORAGE,
  eventAbi: proxyStorageAbi,
  event: 'UpgradeBridge',
  queue: 'home',
  name: `watcher-${id}`,
  id
}
