require('dotenv').config()

const { toBN } = require('web3').utils
const { web3Home, web3Foreign } = require('../src/services/web3')
const { privateKeyToAddress } = require('../src/utils/utils')

const homeErcErcAbi = require('../abis/HomeBridgeErcToErc.abi')
const foreignErcErcAbi = require('../abis/ForeignBridgeErcToErc.abi')

const bridgeMapperAbi = require('../abis/BridgeMapper.abi')

const { VALIDATOR_ADDRESS, VALIDATOR_ADDRESS_PRIVATE_KEY } = process.env

const homeAbi = homeErcErcAbi
const foreignAbi = foreignErcErcAbi
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

const bridgeConfigBasic = {
  homeBridgeAbi: homeAbi,
  foreignBridgeAbi: foreignAbi,
  eventFilter: {},
  validatorAddress: VALIDATOR_ADDRESS || privateKeyToAddress(VALIDATOR_ADDRESS_PRIVATE_KEY),
  maxProcessingTime,
  deployedBridgesRedisKey: process.env.DEPLOYED_BRIDGES_REDIS_KEY || 'deployed:bridges',
  concurrency: process.env.MULTIPLE_BRIDGES_CONCURRENCY || 1
}

const bridgeConfig = {
  ...bridgeConfigBasic,
  homeBridgeAddress: process.env.HOME_BRIDGE_ADDRESS,
  foreignBridgeAddress: process.env.FOREIGN_BRIDGE_ADDRESS
}

const homeConfigBasic = {
  eventAbi: homeAbi,
  bridgeAbi: homeAbi,
  pollingInterval: process.env.HOME_POLLING_INTERVAL,
  web3: web3Home
}

const homeConfig = {
  ...homeConfigBasic,
  eventContractAddress: process.env.HOME_BRIDGE_ADDRESS,
  bridgeContractAddress: process.env.HOME_BRIDGE_ADDRESS,
  startBlock: toBN(process.env.HOME_START_BLOCK || 0)
}

const foreignConfigBasic = {
  eventAbi: foreignAbi,
  bridgeAbi: foreignAbi,
  pollingInterval: process.env.FOREIGN_POLLING_INTERVAL,
  web3: web3Foreign
}

const foreignConfig = {
  ...foreignConfigBasic,
  eventContractAddress: process.env.FOREIGN_BRIDGE_ADDRESS,
  bridgeContractAddress: process.env.FOREIGN_BRIDGE_ADDRESS,
  startBlock: toBN(process.env.FOREIGN_START_BLOCK || 0)
}

const bridgeMapperConfig = {
  web3: web3Home,
  eventContractAddress: process.env.HOME_BRIDGE_MAPPER_ADDRESS,
  eventAbi: bridgeMapperAbi,
  eventFilter: {},
  pollingInterval: process.env.HOME_BRIDGE_MAPPER_POLLING_INTERVAL,
  startBlock: toBN(process.env.HOME_BRIDGE_MAPPER_START_BLOCK || 0),
  maxProcessingTime
}

module.exports = {
  bridgeConfigBasic,
  bridgeConfig,
  homeConfigBasic,
  homeConfig,
  foreignConfigBasic,
  foreignConfig,
  bridgeMapperConfig,
  id
}
