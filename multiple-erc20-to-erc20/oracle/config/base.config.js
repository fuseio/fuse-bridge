require('dotenv').config()

const { toBN } = require('web3').utils
const { web3Home, web3Foreign } = require('../src/services/web3')
const { graphClientHome, graphClientForeign } = require('../src/services/graphClient')
const { privateKeyToAddress } = require('../src/utils/utils')

const homeErcErcAbi = require('../abis/HomeBridgeErcToErc.abi')
const foreignErcErcAbi = require('../abis/ForeignBridgeErcToErc.abi')
const bridgeMapperAbi = require('../abis/BridgeMapper.abi')

const { VALIDATOR_ADDRESS, VALIDATOR_ADDRESS_PRIVATE_KEY } = process.env

const id = 'erc-erc-multiple'

let maxProcessingTime = null
if (String(process.env.MAX_PROCESSING_TIME) === '0') {
  maxProcessingTime = 0
} else if (!process.env.MAX_PROCESSING_TIME) {
  maxProcessingTime =
    4 * Math.max(process.env.HOME_POLLING_INTERVAL, process.env.FOREIGN_POLLING_INTERVAL)
} else {
  maxProcessingTime = Number(process.env.MAX_PROCESSING_TIME)
}

if (!VALIDATOR_ADDRESS_PRIVATE_KEY) {
  throw new Error('Missing VALIDATOR_ADDRESS_PRIVATE_KEY is missing!')
}

const bridgeConfig = {
  homeBridgeAbi: homeErcErcAbi,
  foreignBridgeAbi: foreignErcErcAbi,
  validatorAddress: VALIDATOR_ADDRESS || privateKeyToAddress(VALIDATOR_ADDRESS_PRIVATE_KEY),
  maxProcessingTime,
  deployedBridgesRedisKey: process.env.DEPLOYED_BRIDGES_REDIS_KEY || 'deployed:bridges'
}

const homeConfig = {
  eventAbi: homeErcErcAbi,
  startBlock: toBN(process.env.HOME_START_BLOCK || 0),
  requiredBlockConfirmations: toBN(process.env.HOME_REQUIRED_BLOCK_CONFIRMATIONS || 1),
  pollingInterval: process.env.HOME_POLLING_INTERVAL,
  web3: web3Home,
  graphClient: graphClientHome,
  graphOriginNetwork: process.env.GRAPH_ORIGIN_NETWORK
}

const foreignConfig = {
  eventAbi: foreignErcErcAbi,
  startBlock: toBN(process.env.FOREIGN_START_BLOCK || 0),
  requiredBlockConfirmations: toBN(process.env.FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS || 2),
  pollingInterval: process.env.FOREIGN_POLLING_INTERVAL,
  web3: web3Foreign,
  graphClient: graphClientForeign,
  graphOriginNetwork: process.env.GRAPH_ORIGIN_NETWORK
}

const bridgeMapperConfig = {
  web3: web3Home,
  graphClient: graphClientHome,
  graphOriginNetwork: process.env.GRAPH_ORIGIN_NETWORK,
  eventAbi: bridgeMapperAbi,
  requiredBlockConfirmations: toBN(1),
  pollingInterval: process.env.HOME_BRIDGE_MAPPER_POLLING_INTERVAL,
  startBlock: toBN(process.env.HOME_BRIDGE_MAPPER_START_BLOCK || 0),
  maxProcessingTime
}

module.exports = {
  bridgeConfig,
  homeConfig,
  foreignConfig,
  bridgeMapperConfig,
  id
}
