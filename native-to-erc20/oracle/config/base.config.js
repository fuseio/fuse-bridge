require('dotenv').config()

const { toBN } = require('web3').utils
const { web3Home, web3Foreign } = require('../src/services/web3')
const { privateKeyToAddress, keystoreToPrivateKey } = require('../src/utils/utils')

const homeNativeErcAbi = require('../abis/HomeBridgeNativeToErc.abi')
const foreignNativeErcAbi = require('../abis/ForeignBridgeNativeToErc.abi')

let { VALIDATOR_ADDRESS, VALIDATOR_ADDRESS_PRIVATE_KEY, VALIDATOR_KEYSTORE_DIR, VALIDATOR_KEYSTORE_PASSWORD } = process.env

const id = 'native-erc'

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
  VALIDATOR_ADDRESS_PRIVATE_KEY = keystoreToPrivateKey(VALIDATOR_KEYSTORE_DIR, VALIDATOR_KEYSTORE_PASSWORD)
  process.env.VALIDATOR_ADDRESS_PRIVATE_KEY = VALIDATOR_ADDRESS_PRIVATE_KEY
}

const bridgeConfig = {
  homeBridgeAbi: homeNativeErcAbi,
  homeBridgeAddress: process.env.HOME_BRIDGE_ADDRESS,
  foreignBridgeAbi: foreignNativeErcAbi,
  foreignBridgeAddress: process.env.FOREIGN_BRIDGE_ADDRESS,
  eventFilter: {},
  validatorAddress: VALIDATOR_ADDRESS || privateKeyToAddress(VALIDATOR_ADDRESS_PRIVATE_KEY),
  maxProcessingTime
}

const homeConfig = {
  eventAbi: homeNativeErcAbi,
  eventContractAddress: process.env.HOME_BRIDGE_ADDRESS,
  bridgeAbi: homeNativeErcAbi,
  bridgeContractAddress: process.env.HOME_BRIDGE_ADDRESS,
  startBlock: toBN(process.env.HOME_START_BLOCK || 0),
  pollingInterval: process.env.HOME_POLLING_INTERVAL,
  web3: web3Home
}

const foreignConfig = {
  eventAbi: foreignNativeErcAbi,
  eventContractAddress: process.env.FOREIGN_BRIDGE_ADDRESS,
  bridgeAbi: foreignNativeErcAbi,
  bridgeContractAddress: process.env.FOREIGN_BRIDGE_ADDRESS,
  startBlock: toBN(process.env.FOREIGN_START_BLOCK || 0),
  pollingInterval: process.env.FOREIGN_POLLING_INTERVAL,
  web3: web3Foreign
}

module.exports = {
  bridgeConfig,
  homeConfig,
  foreignConfig,
  id
}
