const assert = require('assert')
const Web3Utils = require('web3-utils')

const env = require('../loadEnv')
const { deployContract, privateKeyToAddress, sendRawTxHome } = require('../deploymentUtils')
const { web3Home, deploymentPrivateKey, HOME_RPC_URL } = require('../web3')

const EternalStorageProxy = require('../../../build/contracts/EternalStorageProxy.json')
const BridgeValidators = require('../../../build/contracts/BridgeValidators.json')
const HomeBridge = require('../../../build/contracts/HomeBridgeNativeToErc.json')

const ConsensusABI = require('../../abis/Consensus.abi.json')

const VALIDATORS = env.VALIDATORS.split(' ')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  HOME_BRIDGE_OWNER,
  HOME_UPGRADEABLE_ADMIN,
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX,
  HOME_MIN_AMOUNT_PER_TX,
  HOME_REQUIRED_BLOCK_CONFIRMATIONS,
  HOME_GAS_PRICE,
  CONSENSUS_ADDRESS,
  FOREIGN_DAILY_LIMIT,
  FOREIGN_MAX_AMOUNT_PER_TX
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployHome() {
  let homeNonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  console.log('\n========================================')
  console.log('deploying HomeBridge')
  console.log('========================================')

  console.log('\ndeploying homeBridge storage')
  const homeBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce: homeNonce
  })
  homeNonce++
  console.log('[Home] HomeBridge Storage: ', homeBridgeStorage.options.address)

  console.log('\ndeploying homeBridge implementation')
  const homeBridgeImplementation = await deployContract(HomeBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce: homeNonce
  })
  homeNonce++
  console.log('[Home] HomeBridge Implementation: ', homeBridgeImplementation.options.address)

  console.log('\nhooking up HomeBridge storage to HomeBridge implementation')
  const upgradeToHomeBridgeData = await homeBridgeStorage.methods
    .upgradeTo('1', homeBridgeImplementation.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txUpgradeToHomeBridge = await sendRawTxHome({
    data: upgradeToHomeBridgeData,
    nonce: homeNonce,
    to: homeBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txUpgradeToHomeBridge.status), 1, 'Transaction Failed')
  homeNonce++

  const consensus = new web3Home.eth.Contract(ConsensusABI, CONSENSUS_ADDRESS)

  console.log('\ninitializing Home Bridge with following parameters:')
  console.log(`
  CONSENSUS: ${consensus.options.address},
  HOME_DAILY_LIMIT : ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
  HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
    HOME_MAX_AMOUNT_PER_TX
  )} in eth,
  HOME_MIN_AMOUNT_PER_TX: ${HOME_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
    HOME_MIN_AMOUNT_PER_TX
  )} in eth,
  HOME_GAS_PRICE: ${HOME_GAS_PRICE}, HOME_REQUIRED_BLOCK_CONFIRMATIONS : ${HOME_REQUIRED_BLOCK_CONFIRMATIONS}
  `)
  homeBridgeImplementation.options.address = homeBridgeStorage.options.address
  const initializeHomeBridgeData = await homeBridgeImplementation.methods
    .initialize(
      consensus.options.address,
      HOME_DAILY_LIMIT.toString(),
      HOME_MAX_AMOUNT_PER_TX.toString(),
      HOME_MIN_AMOUNT_PER_TX.toString(),
      HOME_GAS_PRICE.toString(),
      HOME_REQUIRED_BLOCK_CONFIRMATIONS,
      FOREIGN_DAILY_LIMIT.toString(),
      FOREIGN_MAX_AMOUNT_PER_TX.toString(),
      HOME_BRIDGE_OWNER
    )
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txInitializeHomeBridge = await sendRawTxHome({
    data: initializeHomeBridgeData,
    nonce: homeNonce,
    to: homeBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txInitializeHomeBridge.status), 1, 'Transaction Failed')
  homeNonce++

  console.log('\ntransferring proxy ownership to multisig for Home bridge Proxy contract')
  const homeBridgeProxyData = await homeBridgeStorage.methods
    .transferProxyOwnership(HOME_UPGRADEABLE_ADMIN)
    .encodeABI()
  const txhomeBridgeProxyData = await sendRawTxHome({
    data: homeBridgeProxyData,
    nonce: homeNonce,
    to: homeBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txhomeBridgeProxyData.status), 1, 'Transaction Failed')
  homeNonce++

  console.log('\nHome Deployment Bridge completed')
  return {
    homeBridge: {
      address: homeBridgeStorage.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(homeBridgeStorage.deployedBlockNumber)
    }
  }
}
module.exports = deployHome
