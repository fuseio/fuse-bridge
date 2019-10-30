const baseConfig = require('./base.config')

const id = `${baseConfig.id}-collected-signatures`

module.exports = {
  ...baseConfig.bridgeConfigBasic,
  ...baseConfig.homeConfigBasic,
  event: 'CollectedSignatures',
  queue: 'foreign',
  name: `watcher-${id}`,
  id
}
