require('dotenv').config()
const baseConfig = require('./base.config')

const id = `${baseConfig.id}-affirmation-request`

module.exports = {
  ...baseConfig.bridgeConfig,
  ...baseConfig.foreignConfig,
  event: 'UserRequestForAffirmation',
  queue: 'home',
  name: `watcher-${id}`,
  id
}
