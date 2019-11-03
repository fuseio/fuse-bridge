const baseConfig = require('./base.config')

const id = `${baseConfig.id}-deployed-bridges`

module.exports = {
  ...baseConfig.bridgeConfig,
  ...baseConfig.bridgeMapperConfig,
  event: 'BridgeMappingUpdated',
  name: `watcher-${id}`,
  id
}
