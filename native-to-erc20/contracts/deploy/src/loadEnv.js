const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
})
const { isAddress, toBN } = require('web3-utils')
const envalid = require('envalid')

const bigNumValidator = envalid.makeValidator(x => toBN(x))
const validateAddress = address => {
  if (isAddress(address)) { return address }
  throw new Error(`Invalid address: ${address}`)
}
const addressValidator = envalid.makeValidator(validateAddress)
const addressesValidator = envalid.makeValidator(addresses => {
  addresses.split(' ').forEach(validateAddress)
  return addresses
})

const { USE_EXISTING_TOKEN } = process.env
const { UPGRADE_FOREIGN } = process.env

let validations = {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY: envalid.str(),
  DEPLOYMENT_GAS_LIMIT: bigNumValidator(),
  HOME_DEPLOYMENT_GAS_PRICE: bigNumValidator(),
  FOREIGN_DEPLOYMENT_GAS_PRICE: bigNumValidator(),
  GET_RECEIPT_INTERVAL_IN_MILLISECONDS: bigNumValidator(),
  HOME_RPC_URL: envalid.str(),
  HOME_BRIDGE_OWNER: addressValidator(),
  HOME_UPGRADEABLE_ADMIN: addressValidator(),
  HOME_DAILY_LIMIT: bigNumValidator(),
  HOME_MAX_AMOUNT_PER_TX: bigNumValidator(),
  HOME_MIN_AMOUNT_PER_TX: bigNumValidator(),
  HOME_REQUIRED_BLOCK_CONFIRMATIONS: envalid.num(),
  HOME_GAS_PRICE: bigNumValidator(),
  CONSENSUS_ADDRESS: addressValidator(),
  FOREIGN_RPC_URL: envalid.str(),
  FOREIGN_BRIDGE_OWNER: addressValidator(),
  FOREIGN_UPGRADEABLE_ADMIN: addressValidator(),
  FOREIGN_DAILY_LIMIT: bigNumValidator(),
  FOREIGN_MAX_AMOUNT_PER_TX: bigNumValidator(),
  FOREIGN_MIN_AMOUNT_PER_TX: bigNumValidator(),
  FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS: envalid.num(),
  FOREIGN_GAS_PRICE: bigNumValidator(),
  VALIDATORS: addressesValidator(),
  USE_EXISTING_TOKEN: envalid.bool()
}

if (USE_EXISTING_TOKEN == 'true') {
  validations = {
    ...validations,
    BRIDGEABLE_TOKEN_ADDRESS: addressValidator()
  }
} else {
  validations = {
  ...validations,
    BRIDGEABLE_TOKEN_NAME: envalid.str(),
    BRIDGEABLE_TOKEN_SYMBOL: envalid.str(),
    BRIDGEABLE_TOKEN_DECIMALS: envalid.num(),
    BRIDGEABLE_TOKEN_PRE_MINTED: envalid.bool(),
    BRIDGEABLE_TOKEN_INITIAL_SUPPLY_ETH: envalid.num()
  }
}

if(UPGRADE_FOREIGN == 'true') {
  validations = {
    ...validations,
    FOREIGN_BRIDGE_STORAGE_ADDRESS: addressValidator()
  }
}

const env = envalid.cleanEnv(process.env, validations)

module.exports = env
