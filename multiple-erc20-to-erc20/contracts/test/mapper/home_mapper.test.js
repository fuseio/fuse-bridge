const ethUtils = require('ethereumjs-util')
const {getEventFromLogs, toBufferStripPrefix} = require('../helpers')

const BridgeMapper = artifacts.require("BridgeMapper.sol")
const ForeignBridgeFactory = artifacts.require("ForeignBridgeFactory.sol")
const HomeBridgeFactory = artifacts.require("HomeBridgeFactory.sol")
const ForeignBridge = artifacts.require("ForeignBridgeErcToErc.sol")
const HomeBridge = artifacts.require("HomeBridgeErcToErc.sol")
const BridgeValidators = artifacts.require("BridgeValidators.sol")
const ERC677BridgeToken = artifacts.require("ERC677BridgeToken.sol")

const {ERROR_MSG, ZERO_ADDRESS, INVALID_ARGUMENTS} = require('../setup')
const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"))
const quarterEther = web3.toBigNumber(web3.toWei(0.25, "ether"))
const requiredSignatures = 1
const requiredBlockConfirmations = 8
const gasPrice = web3.toWei('1', 'gwei')
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"))
const homeDailyLimit = oneEther
const homeMaxPerTx = halfEther
const maxPerTx = halfEther
const minPerTx = quarterEther
const foreignDailyLimit = oneEther
const foreignMaxPerTx = halfEther

const INVALID_OWNER_ADDRESS = 'VM Exception while processing transaction: revert Invalid from address recovered'
const TRANSACTION_USED = 'Transaction hash was already used'

contract('BridgeMapper', async (accounts) => {
  let validatorContract,
    owner,
    ownerPrivateKey,
    notOwner,
    notOwnerPrivateKey,
    foreignBridgeContract,
    homeBridgeContract,
    homeBridgeFactory,
    foreignBridgeFactory

  before(async () => {
    owner = accounts[0]
    notOwner = accounts[1]

    ownerPrivateKey = toBufferStripPrefix('0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501200')
    notOwnerPrivateKey = toBufferStripPrefix('0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201')

    validatorContract = await BridgeValidators.new()
    foreignBridgeContract = await ForeignBridge.new()
    homeBridgeContract = await HomeBridge.new()
    foreignBridgeFactory = await ForeignBridgeFactory.new()
    homeBridgeFactory = await HomeBridgeFactory.new()

    await foreignBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, foreignBridgeContract.address, requiredBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, owner)
    await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner)
  })

  describe('#initialize', async () => {
    it('should initialize', async () => {
      let bridgeMapper = await BridgeMapper.new()

      false.should.be.equal(await bridgeMapper.isInitialized())
      ZERO_ADDRESS.should.be.equal(await bridgeMapper.owner())

      await bridgeMapper.initialize().should.be.rejectedWith(INVALID_ARGUMENTS)

      await bridgeMapper.initialize(owner)

      true.should.be.equal(await bridgeMapper.isInitialized())
      owner.should.be.equal(await bridgeMapper.owner())
    })
  })

  describe('#addBridgeMapping', async () => {
    let bridgeMapper
    before(async () => {
      bridgeMapper = await BridgeMapper.new()
      await bridgeMapper.initialize(owner)
    })

    it('should not add mapping if params are wrong/missng', async () => {
      let foreignToken = await ERC677BridgeToken.new("Foreign ERC20", "FSMT", 18)
      let foreignBridgeDeployedArgs = getEventFromLogs((await foreignBridgeFactory.deployForeignBridge(foreignToken.address)).logs, 'ForeignBridgeDeployed').args

      let homeToken = { name: "Home ERC20", symbol: "HSMT", decimals: 18 }
      let homeBridgeDeployedArgs = getEventFromLogs((await homeBridgeFactory.deployHomeBridge(homeToken.name, homeToken.symbol, homeToken.decimals)).logs, 'HomeBridgeDeployed').args

      const key = '0x0000000000000000000000000000000000000000000000000000000000000001'
      await bridgeMapper.addBridgeMapping().should.be.rejectedWith(INVALID_ARGUMENTS)
      await bridgeMapper.addBridgeMapping(ZERO_ADDRESS, foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber, ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG)
      await bridgeMapper.addBridgeMapping(key, ZERO_ADDRESS, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber, ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG)
      await bridgeMapper.addBridgeMapping(key, foreignToken.address, ZERO_ADDRESS, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber, ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG)
      await bridgeMapper.addBridgeMapping(key, foreignToken.address, homeBridgeDeployedArgs._token, ZERO_ADDRESS, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber, ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG)
      await bridgeMapper.addBridgeMapping(key, foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, ZERO_ADDRESS, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber, ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG)
      await bridgeMapper.addBridgeMapping(key, foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, 0, homeBridgeDeployedArgs._blockNumber, ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG)
      await bridgeMapper.addBridgeMapping(key, foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, 0, ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG)
    })

    it('should add a bridge mapping', async () => {
      let foreignToken = await ERC677BridgeToken.new("Foreign ERC20", "FSMT_1", 18)
      let foreignBridgeDeployedArgs = getEventFromLogs((await foreignBridgeFactory.deployForeignBridge(foreignToken.address)).logs, 'ForeignBridgeDeployed').args

      let homeToken = { name: "Home ERC20", symbol: "HSMT_1", decimals: 18 }
      let homeBridgeDeployedArgs = getEventFromLogs((await homeBridgeFactory.deployHomeBridge(homeToken.name, homeToken.symbol, homeToken.decimals)).logs, 'HomeBridgeDeployed').args

      const key = '0x0000000000000000000000000000000000000000000000000000000000000001'
      let {logs} = await bridgeMapper.addBridgeMapping(key, foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber, ZERO_ADDRESS)
      let {args} = getEventFromLogs(logs, 'BridgeMappingUpdated')

      key.should.be.equal(args.key)
      foreignToken.address.should.be.equal(args.foreignToken)
      homeBridgeDeployedArgs._token.should.be.equal(args.homeToken)
      foreignBridgeDeployedArgs._foreignBridge.should.be.equal(args.foreignBridge)
      homeBridgeDeployedArgs._homeBridge.should.be.equal(args.homeBridge)
      foreignBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(args.foreignStartBlock)
      homeBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(args.homeStartBlock)

      homeBridgeDeployedArgs._token.should.be.equal(await bridgeMapper.homeTokenByKey(key))
      foreignToken.address.should.be.equal(await bridgeMapper.foreignTokenByKey(key))
      foreignBridgeDeployedArgs._foreignBridge.should.be.equal(await bridgeMapper.foreignBridgeByKey(key))
      homeBridgeDeployedArgs._homeBridge.should.be.equal(await bridgeMapper.homeBridgeByKey(key))
      foreignBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(await bridgeMapper.foreignStartBlockByKey(key))
      homeBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(await bridgeMapper.homeStartBlockByKey(key))
    })

    it('should not add a bridge mapping if caller is not the owner and signature not given', async () => {
      let foreignToken = await ERC677BridgeToken.new("Foreign ERC20", "FSMT_1", 18)
      let foreignBridgeDeployedArgs = getEventFromLogs((await foreignBridgeFactory.deployForeignBridge(foreignToken.address)).logs, 'ForeignBridgeDeployed').args

      let homeToken = { name: "Home ERC20", symbol: "HSMT_1", decimals: 18 }
      let homeBridgeDeployedArgs = getEventFromLogs((await homeBridgeFactory.deployHomeBridge(homeToken.name, homeToken.symbol, homeToken.decimals)).logs, 'HomeBridgeDeployed').args

      const key = '0x0000000000000000000000000000000000000000000000000000000000000001'
      await bridgeMapper.addBridgeMapping(key,
        foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge,
        homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber,
        homeBridgeDeployedArgs._blockNumber, ZERO_ADDRESS,
        {from: notOwner}).should.be.rejectedWith(INVALID_OWNER_ADDRESS)
    })

    it('should add a bridge mapping if the sender is not the owner but got the correct signature', async () => {
      let foreignToken = await ERC677BridgeToken.new("Foreign ERC20", "FSMT_1", 18)
      let foreignBridgeDeployedArgs = getEventFromLogs((await foreignBridgeFactory.deployForeignBridge(foreignToken.address)).logs, 'ForeignBridgeDeployed').args

      let homeToken = { name: "Home ERC20", symbol: "HSMT_1", decimals: 18 }
      let homeBridgeDeployedArgs = getEventFromLogs((await homeBridgeFactory.deployHomeBridge(homeToken.name, homeToken.symbol, homeToken.decimals)).logs, 'HomeBridgeDeployed').args

      const key = '0x0000000000000000000000000000000000000000000000000000000000000001'

      const arguments = [key, foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber]

      const msg = await bridgeMapper.getAddBridgeMappingHash(...arguments)
      const vrs = ethUtils.ecsign(toBufferStripPrefix(msg), ownerPrivateKey)
      const sig = ethUtils.toRpcSig(vrs.v, vrs.r, vrs.s)

      const {logs} = await bridgeMapper.addBridgeMapping(...arguments, sig, {from: notOwner})
      let {args} = getEventFromLogs(logs, 'BridgeMappingUpdated')

      key.should.be.equal(args.key)
      foreignToken.address.should.be.equal(args.foreignToken)
      homeBridgeDeployedArgs._token.should.be.equal(args.homeToken)
      foreignBridgeDeployedArgs._foreignBridge.should.be.equal(args.foreignBridge)
      homeBridgeDeployedArgs._homeBridge.should.be.equal(args.homeBridge)
      foreignBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(args.foreignStartBlock)
      homeBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(args.homeStartBlock)

      homeBridgeDeployedArgs._token.should.be.equal(await bridgeMapper.homeTokenByKey(key))
      foreignToken.address.should.be.equal(await bridgeMapper.foreignTokenByKey(key))
      foreignBridgeDeployedArgs._foreignBridge.should.be.equal(await bridgeMapper.foreignBridgeByKey(key))
      homeBridgeDeployedArgs._homeBridge.should.be.equal(await bridgeMapper.homeBridgeByKey(key))
      foreignBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(await bridgeMapper.foreignStartBlockByKey(key))
      homeBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(await bridgeMapper.homeStartBlockByKey(key))
    })

    it('should not add a bridge mapping if the sender is not the owner but got (wrong) signature from not owner', async () => {
      let foreignToken = await ERC677BridgeToken.new("Foreign ERC20", "FSMT_1", 18)
      let foreignBridgeDeployedArgs = getEventFromLogs((await foreignBridgeFactory.deployForeignBridge(foreignToken.address)).logs, 'ForeignBridgeDeployed').args

      let homeToken = { name: "Home ERC20", symbol: "HSMT_1", decimals: 18 }
      let homeBridgeDeployedArgs = getEventFromLogs((await homeBridgeFactory.deployHomeBridge(homeToken.name, homeToken.symbol, homeToken.decimals)).logs, 'HomeBridgeDeployed').args

      const key = '0x0000000000000000000000000000000000000000000000000000000000000001'

      const arguments = [key, foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber]

      const msg = await bridgeMapper.getAddBridgeMappingHash(...arguments)
      const vrs = ethUtils.ecsign(toBufferStripPrefix(msg), notOwnerPrivateKey)
      const sig = ethUtils.toRpcSig(vrs.v, vrs.r, vrs.s)

      await bridgeMapper.addBridgeMapping(...arguments, sig, {from: notOwner}).should.be.rejectedWith(INVALID_OWNER_ADDRESS)
    })


    it('should not add a bridge mapping if the sender is not the owner but got (wrong) signature with different arguments', async () => {
      let foreignToken = await ERC677BridgeToken.new("Foreign ERC20", "FSMT_1", 18)
      let foreignBridgeDeployedArgs = getEventFromLogs((await foreignBridgeFactory.deployForeignBridge(foreignToken.address)).logs, 'ForeignBridgeDeployed').args

      let homeToken = { name: "Home ERC20", symbol: "HSMT_1", decimals: 18 }
      let homeBridgeDeployedArgs = getEventFromLogs((await homeBridgeFactory.deployHomeBridge(homeToken.name, homeToken.symbol, homeToken.decimals)).logs, 'HomeBridgeDeployed').args

      const key = '0x0000000000000000000000000000000000000000000000000000000000000001'

      const arguments = [key, foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber]

      const msg = await bridgeMapper.getAddBridgeMappingHash(...arguments)
      const vrs = ethUtils.ecsign(toBufferStripPrefix(msg), ownerPrivateKey)
      const sig = ethUtils.toRpcSig(vrs.v, vrs.r, vrs.s)

      // sending with different key
      arguments[0] = '0x0000000000000000000000000000000000000000000000000000000000000002'
      await bridgeMapper.addBridgeMapping(...arguments, sig, {from: notOwner}).should.be.rejectedWith(INVALID_OWNER_ADDRESS)
    })


    it('cannot send the same signature twice', async () => {
      let foreignToken = await ERC677BridgeToken.new("Foreign ERC20", "FSMT_1", 18)
      let foreignBridgeDeployedArgs = getEventFromLogs((await foreignBridgeFactory.deployForeignBridge(foreignToken.address)).logs, 'ForeignBridgeDeployed').args

      let homeToken = { name: "Home ERC20", symbol: "HSMT_1", decimals: 18 }
      let homeBridgeDeployedArgs = getEventFromLogs((await homeBridgeFactory.deployHomeBridge(homeToken.name, homeToken.symbol, homeToken.decimals)).logs, 'HomeBridgeDeployed').args

      const key = '0x0000000000000000000000000000000000000000000000000000000000000001'

      const arguments = [key, foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber]

      const msg = await bridgeMapper.getAddBridgeMappingHash(...arguments)
      const vrs = ethUtils.ecsign(toBufferStripPrefix(msg), ownerPrivateKey)
      const sig = ethUtils.toRpcSig(vrs.v, vrs.r, vrs.s)

      let {logs} = await bridgeMapper.addBridgeMapping(...arguments, sig, { from: notOwner})
      let {args} = getEventFromLogs(logs, 'BridgeMappingUpdated')

      key.should.be.equal(args.key)
      foreignToken.address.should.be.equal(args.foreignToken)
      homeBridgeDeployedArgs._token.should.be.equal(args.homeToken)
      foreignBridgeDeployedArgs._foreignBridge.should.be.equal(args.foreignBridge)
      homeBridgeDeployedArgs._homeBridge.should.be.equal(args.homeBridge)
      foreignBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(args.foreignStartBlock)
      homeBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(args.homeStartBlock)

      homeBridgeDeployedArgs._token.should.be.equal(await bridgeMapper.homeTokenByKey(key))
      foreignToken.address.should.be.equal(await bridgeMapper.foreignTokenByKey(key))
      foreignBridgeDeployedArgs._foreignBridge.should.be.equal(await bridgeMapper.foreignBridgeByKey(key))
      homeBridgeDeployedArgs._homeBridge.should.be.equal(await bridgeMapper.homeBridgeByKey(key))
      foreignBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(await bridgeMapper.foreignStartBlockByKey(key))
      homeBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(await bridgeMapper.homeStartBlockByKey(key))

      // sending the same sig for the second time
      await bridgeMapper.addBridgeMapping(...arguments, sig, {from: notOwner}).should.be.rejectedWith(TRANSACTION_USED)
    })

    it('should add a second bridge mapping using same mapper', async () => {
      let foreignToken = await ERC677BridgeToken.new("Another Foreign ERC20", "FSMT_2", 18)
      let foreignBridgeDeployedArgs = getEventFromLogs((await foreignBridgeFactory.deployForeignBridge(foreignToken.address)).logs, 'ForeignBridgeDeployed').args

      let homeToken = { name: "Another Home ERC20", symbol: "HSMT_2", decimals: 18 }
      let homeBridgeDeployedArgs = getEventFromLogs((await homeBridgeFactory.deployHomeBridge(homeToken.name, homeToken.symbol, homeToken.decimals)).logs, 'HomeBridgeDeployed').args

      const key = '0x0000000000000000000000000000000000000000000000000000000000000002'
      let {logs} = await bridgeMapper.addBridgeMapping(key, foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber, ZERO_ADDRESS)
      let {args} = getEventFromLogs(logs, 'BridgeMappingUpdated')

      key.should.be.equal(args.key)
      foreignToken.address.should.be.equal(args.foreignToken)
      homeBridgeDeployedArgs._token.should.be.equal(args.homeToken)
      foreignBridgeDeployedArgs._foreignBridge.should.be.equal(args.foreignBridge)
      homeBridgeDeployedArgs._homeBridge.should.be.equal(args.homeBridge)
      foreignBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(args.foreignStartBlock)
      homeBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(args.homeStartBlock)

      homeBridgeDeployedArgs._token.should.be.equal(await bridgeMapper.homeTokenByKey(key))
      foreignToken.address.should.be.equal(await bridgeMapper.foreignTokenByKey(key))
      foreignBridgeDeployedArgs._foreignBridge.should.be.equal(await bridgeMapper.foreignBridgeByKey(key))
      homeBridgeDeployedArgs._homeBridge.should.be.equal(await bridgeMapper.homeBridgeByKey(key))
      foreignBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(await bridgeMapper.foreignStartBlockByKey(key))
      homeBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(await bridgeMapper.homeStartBlockByKey(key))
    })
  })

  describe('#removeBridgeMapping', async () => {
    let bridgeMapper
    before(async () => {
      bridgeMapper = await BridgeMapper.new()
      await bridgeMapper.initialize(owner)
    })

    it('should remove a bridge mapping', async () => {
      let foreignToken = await ERC677BridgeToken.new("Foreign ERC20", "FSMT", 18)
      let foreignBridgeDeployedArgs = getEventFromLogs((await foreignBridgeFactory.deployForeignBridge(foreignToken.address)).logs, 'ForeignBridgeDeployed').args

      let homeToken = { name: "Home ERC20", symbol: "HSMT", decimals: 18 }
      let homeBridgeDeployedArgs = getEventFromLogs((await homeBridgeFactory.deployHomeBridge(homeToken.name, homeToken.symbol, homeToken.decimals)).logs, 'HomeBridgeDeployed').args

      const key = '0x0000000000000000000000000000000000000000000000000000000000000003'
      await bridgeMapper.addBridgeMapping(key, foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber, ZERO_ADDRESS)

      let {logs} = await bridgeMapper.removeBridgeMapping(key)
      let {args} = getEventFromLogs(logs, 'BridgeMappingUpdated')

      key.should.be.equal(args.key)
      ZERO_ADDRESS.should.be.equal(args.foreignToken)
      ZERO_ADDRESS.should.be.equal(args.homeToken)
      ZERO_ADDRESS.should.be.equal(args.foreignBridge)
      ZERO_ADDRESS.should.be.equal(args.homeBridge)
      '0'.should.be.bignumber.equal(args.foreignStartBlock)
      '0'.should.be.bignumber.equal(args.homeStartBlock)

      ZERO_ADDRESS.should.be.equal(await bridgeMapper.homeBridgeByKey(key))
      ZERO_ADDRESS.should.be.equal(await bridgeMapper.foreignTokenByKey(key))
      ZERO_ADDRESS.should.be.equal(await bridgeMapper.foreignBridgeByKey(key))
      ZERO_ADDRESS.should.be.equal(await bridgeMapper.homeTokenByKey(key))
      '0'.should.be.bignumber.equal(await bridgeMapper.homeStartBlockByKey(key))
      '0'.should.be.bignumber.equal(await bridgeMapper.foreignStartBlockByKey(key))
    })
  })
})
