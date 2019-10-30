const baseConfig = require('./base.config')

const id = `${baseConfig.id}-signature-request`

module.exports = {
  ...baseConfig.bridgeConfigBasic,
  ...baseConfig.homeConfigBasic,
  event: 'UserRequestForSignature',
  queue: 'home',
  name: `watcher-${id}`,
  id
}
