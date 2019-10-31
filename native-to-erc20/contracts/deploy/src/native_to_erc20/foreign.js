const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')

const { deployContract, privateKeyToAddress, sendRawTxForeign } = require('../deploymentUtils')
const { web3Foreign, deploymentPrivateKey, FOREIGN_RPC_URL } = require('../web3')

const ERC677BridgeToken = require('../../../build/contracts/ERC677BridgeToken.json')
const EternalStorageProxy = require('../../../build/contracts/EternalStorageProxy.json')
const ForeignBridgeValidators = require('../../../build/contracts/ForeignBridgeValidators.json')
const ForeignBridge = require('../../../build/contracts/ForeignBridgeNativeToErc.json')

const VALIDATORS = env.VALIDATORS.split(' ')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  FOREIGN_BRIDGE_OWNER,
  FOREIGN_UPGRADEABLE_ADMIN,
  FOREIGN_DAILY_LIMIT,
  FOREIGN_MAX_AMOUNT_PER_TX,
  FOREIGN_MIN_AMOUNT_PER_TX,
  FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
  FOREIGN_GAS_PRICE,
  USE_EXISTING_TOKEN,
  BRIDGEABLE_TOKEN_ADDRESS,
  BRIDGEABLE_TOKEN_NAME,
  BRIDGEABLE_TOKEN_SYMBOL,
  BRIDGEABLE_TOKEN_DECIMALS,
  BRIDGEABLE_TOKEN_PRE_MINTED,
  BRIDGEABLE_TOKEN_INITIAL_SUPPLY_ETH,
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployForeign() {
  let foreignNonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  console.log('\n========================================')
  console.log('deploying ForeignBridge')
  console.log('========================================')

  let erc677bridgeToken
  if (USE_EXISTING_TOKEN) {
    erc677bridgeToken = new web3Foreign.eth.Contract(ERC677BridgeToken.abi, BRIDGEABLE_TOKEN_ADDRESS)
  } else {
    console.log(`\n[Foreign] deploying ${BRIDGEABLE_TOKEN_SYMBOL} token`)
    erc677bridgeToken = await deployContract(
      ERC677BridgeToken,
      [BRIDGEABLE_TOKEN_NAME, BRIDGEABLE_TOKEN_SYMBOL, BRIDGEABLE_TOKEN_DECIMALS],
      { from: DEPLOYMENT_ACCOUNT_ADDRESS, network: 'foreign', nonce: foreignNonce }
    )
    foreignNonce++
  }
  console.log(`[Foreign] ERC677BridgeToken: ${erc677bridgeToken.options.address}`)

  console.log('\ndeploying storage for foreign validators')
  const storageValidatorsForeign = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log('[Foreign] BridgeValidators Storage: ', storageValidatorsForeign.options.address)

  console.log('\ndeploying storage for foreign bridge')
  const foreignBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log('[Foreign] ForeignBridge Storage: ', foreignBridgeStorage.options.address)

  console.log('\ndeploying implementation for foreign validators')
  const bridgeValidatorsForeign = await deployContract(ForeignBridgeValidators, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log('[Foreign] BridgeValidators Implementation: ', bridgeValidatorsForeign.options.address)

  console.log('\ndeploying implementation for foreign bridge')
  const foreignBridgeImplementation = await deployContract(ForeignBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log('[Foreign] ForeignBridge Implementation: ', foreignBridgeImplementation.options.address)

  console.log('\nhooking up eternal storage to BridgeValidators')
  const upgradeToBridgeVForeignData = await storageValidatorsForeign.methods
    .upgradeTo('1', bridgeValidatorsForeign.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txUpgradeToBridgeVForeign = await sendRawTxForeign({
    data: upgradeToBridgeVForeignData,
    nonce: foreignNonce,
    to: storageValidatorsForeign.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txUpgradeToBridgeVForeign.status), 1, 'Transaction Failed')
  foreignNonce++

  console.log('\ninitializing Foreign Bridge Validators with following parameters:')
  console.log(
    `VALIDATORS: ${VALIDATORS}, OWNER: ${foreignBridgeStorage.options.address}`
  )
  bridgeValidatorsForeign.options.address = storageValidatorsForeign.options.address
  const initializeForeignData = await bridgeValidatorsForeign.methods
    .initialize(VALIDATORS, foreignBridgeStorage.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txInitializeForeign = await sendRawTxForeign({
    data: initializeForeignData,
    nonce: foreignNonce,
    to: bridgeValidatorsForeign.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txInitializeForeign.status), 1, 'Transaction Failed')
  foreignNonce++

  console.log('\nTransferring ownership of ValidatorsProxy')
  const validatorsForeignOwnershipData = await storageValidatorsForeign.methods
    .transferProxyOwnership(FOREIGN_UPGRADEABLE_ADMIN)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txValidatorsForeignOwnershipData = await sendRawTxForeign({
    data: validatorsForeignOwnershipData,
    nonce: foreignNonce,
    to: storageValidatorsForeign.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(
    Web3Utils.hexToNumber(txValidatorsForeignOwnershipData.status),
    1,
    'Transaction Failed'
  )
  foreignNonce++

  console.log('\nhooking up ForeignBridge storage to ForeignBridge implementation')
  const upgradeToForeignBridgeData = await foreignBridgeStorage.methods
    .upgradeTo('1', foreignBridgeImplementation.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txUpgradeToForeignBridge = await sendRawTxForeign({
    data: upgradeToForeignBridgeData,
    nonce: foreignNonce,
    to: foreignBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(
    Web3Utils.hexToNumber(txUpgradeToForeignBridge.status),
    1,
    'Transaction Failed'
  )
  foreignNonce++

  console.log('\ninitializing Foreign Bridge with following parameters:')
  console.log(`
  FOREIGN_VALIDATORS: ${storageValidatorsForeign.options.address},
  FOREIGN_DAILY_LIMIT : ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(
    FOREIGN_DAILY_LIMIT
  )} in eth,
  FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
    FOREIGN_MAX_AMOUNT_PER_TX
  )} in eth,
  FOREIGN_MIN_AMOUNT_PER_TX: ${FOREIGN_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
    FOREIGN_MIN_AMOUNT_PER_TX
  )} in eth
  `)
  foreignBridgeImplementation.options.address = foreignBridgeStorage.options.address
  const initializeFBridgeData = await foreignBridgeImplementation.methods
    .initialize(
      storageValidatorsForeign.options.address,
      erc677bridgeToken.options.address,
      FOREIGN_DAILY_LIMIT,
      FOREIGN_MAX_AMOUNT_PER_TX,
      FOREIGN_MIN_AMOUNT_PER_TX,
      FOREIGN_GAS_PRICE,
      FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
      HOME_DAILY_LIMIT,
      HOME_MAX_AMOUNT_PER_TX,
      FOREIGN_BRIDGE_OWNER,
      BRIDGEABLE_TOKEN_PRE_MINTED
    )
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txInitializeBridge = await sendRawTxForeign({
    data: initializeFBridgeData,
    nonce: foreignNonce,
    to: foreignBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txInitializeBridge.status), 1, 'Transaction Failed')
  foreignNonce++

  console.log('\nset bridge contract on ERC677BridgeToken')
  const setBridgeContractData = await erc677bridgeToken.methods
    .setBridgeContract(foreignBridgeStorage.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const setBridgeContract = await sendRawTxForeign({
    data: setBridgeContractData,
    nonce: foreignNonce,
    to: erc677bridgeToken.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(setBridgeContract.status), 1, 'Transaction Failed')
  foreignNonce++

  if (BRIDGEABLE_TOKEN_PRE_MINTED) {
    console.log('\nminting ERC677BridgeToken on foreignBridge contract')
    const txMintOnForeignBridgeData = await erc677bridgeToken.methods
      .mint(foreignBridgeStorage.options.address, Web3Utils.toWei(BRIDGEABLE_TOKEN_INITIAL_SUPPLY_ETH.toString()))
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
    const txMintOnForeignBridge = await sendRawTxForeign({
      data: txMintOnForeignBridgeData,
      nonce: foreignNonce,
      to: erc677bridgeToken.options.address,
      privateKey: deploymentPrivateKey,
      url: FOREIGN_RPC_URL
    })
    assert.strictEqual(Web3Utils.hexToNumber(txMintOnForeignBridge.status), 1, 'Transaction Failed')
    foreignNonce++
  }

  console.log('\nadding foreignBridge contract as ERC677BridgeToken minter')
  const txAddMinterData = await erc677bridgeToken.methods
    .addMinter(foreignBridgeStorage.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txAddMinter = await sendRawTxForeign({
    data: txAddMinterData,
    nonce: foreignNonce,
    to: erc677bridgeToken.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txAddMinter.status), 1, 'Transaction Failed')
  foreignNonce++

  console.log('\nTransferring ownership of ForeignBridge')
  const bridgeOwnershipData = await foreignBridgeStorage.methods
    .transferProxyOwnership(FOREIGN_UPGRADEABLE_ADMIN)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txBridgeOwnershipData = await sendRawTxForeign({
    data: bridgeOwnershipData,
    nonce: foreignNonce,
    to: foreignBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txBridgeOwnershipData.status), 1, 'Transaction Failed')
  foreignNonce++

  console.log('\nForeign Deployment Bridge completed')
  return {
    foreignBridge: {
      address: foreignBridgeStorage.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(foreignBridgeStorage.deployedBlockNumber)
    },
    erc677: { address: erc677bridgeToken.options.address }
  }
}

module.exports = deployForeign
