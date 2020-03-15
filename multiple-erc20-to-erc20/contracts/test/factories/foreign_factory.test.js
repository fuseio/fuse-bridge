const ForeignBridgeFactory = artifacts.require("ForeignBridgeFactory.sol")
const ForeignBridge = artifacts.require("ForeignBridgeErcToErc.sol")
const BridgeValidators = artifacts.require("BridgeValidators.sol")
const ERC677BridgeToken = artifacts.require("ERC677BridgeToken.sol")

const {ERROR_MSG, ZERO_ADDRESS, INVALID_ARGUMENTS} = require('../setup')
const {getEventFromLogs} = require('../helpers')
const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"))
const requiredSignatures = 1
const requiredBlockConfirmations = 8
const gasPrice = web3.toWei('1', 'gwei')
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"))
const homeDailyLimit = oneEther
const homeMaxPerTx = halfEther
const maxPerTx = halfEther

contract('ForeignBridgeFactory', async (accounts) => {
  let validatorContract, foreignBridgeContract, owner
  before(async () => {
    validatorContract = await BridgeValidators.new()
    foreignBridgeContract = await ForeignBridge.new()
    owner = accounts[0]
  })

  describe('#initialize', async () => {
    it('should initialize', async () => {
      let foreignBridgeFactory = await ForeignBridgeFactory.new()

      false.should.be.equal(await foreignBridgeFactory.isInitialized())
      ZERO_ADDRESS.should.be.equal(await foreignBridgeFactory.bridgeValidatorsImplementation())
      '0'.should.be.bignumber.equal(await foreignBridgeFactory.requiredSignatures())
      ZERO_ADDRESS.should.be.equal(await foreignBridgeFactory.bridgeValidatorsOwner())
      ZERO_ADDRESS.should.be.equal(await foreignBridgeFactory.bridgeValidatorsProxyOwner())
      ZERO_ADDRESS.should.be.equal(await foreignBridgeFactory.foreignBridgeErcToErcImplementation())
      '0'.should.be.bignumber.equal(await foreignBridgeFactory.requiredBlockConfirmations())
      '0'.should.be.bignumber.equal(await foreignBridgeFactory.gasPrice())
      '0'.should.be.bignumber.equal(await foreignBridgeFactory.foreignMaxPerTx())
      '0'.should.be.bignumber.equal(await foreignBridgeFactory.homeDailyLimit())
      '0'.should.be.bignumber.equal(await foreignBridgeFactory.homeMaxPerTx())
      ZERO_ADDRESS.should.be.equal(await foreignBridgeFactory.foreignBridgeOwner())
      ZERO_ADDRESS.should.be.equal(await foreignBridgeFactory.foreignBridgeProxyOwner())

      await foreignBridgeFactory.initialize().should.be.rejectedWith(INVALID_ARGUMENTS)
      await foreignBridgeFactory.initialize(ZERO_ADDRESS, validatorContract.address, requiredSignatures, [owner], owner, foreignBridgeContract.address, requiredBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeFactory.initialize(owner, ZERO_ADDRESS, requiredSignatures, [owner], owner, foreignBridgeContract.address, requiredBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeFactory.initialize(owner, validatorContract.address, 0, [owner], owner, foreignBridgeContract.address, requiredBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [], owner, foreignBridgeContract.address, requiredBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], ZERO_ADDRESS, foreignBridgeContract.address, requiredBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, ZERO_ADDRESS, requiredBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, foreignBridgeContract.address, 0, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, foreignBridgeContract.address, requiredBlockConfirmations, 0, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, foreignBridgeContract.address, requiredBlockConfirmations, gasPrice, maxPerTx, 0, homeMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, foreignBridgeContract.address, requiredBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeDailyLimit, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, foreignBridgeContract.address, requiredBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, ZERO_ADDRESS, owner).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, foreignBridgeContract.address, requiredBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG)

      await foreignBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, foreignBridgeContract.address, requiredBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, owner)


      true.should.be.equal(await foreignBridgeFactory.isInitialized())
      validatorContract.address.should.be.equal(await foreignBridgeFactory.bridgeValidatorsImplementation())
      requiredSignatures.should.be.bignumber.equal(await foreignBridgeFactory.requiredSignatures())
      owner.should.be.equal(await foreignBridgeFactory.bridgeValidatorsOwner())
      owner.should.be.equal(await foreignBridgeFactory.bridgeValidatorsProxyOwner())
      foreignBridgeContract.address.should.be.equal(await foreignBridgeFactory.foreignBridgeErcToErcImplementation())
      requiredBlockConfirmations.should.be.bignumber.equal(await foreignBridgeFactory.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await foreignBridgeFactory.gasPrice())
      maxPerTx.should.be.bignumber.equal(await foreignBridgeFactory.foreignMaxPerTx())
      homeDailyLimit.should.be.bignumber.equal(await foreignBridgeFactory.homeDailyLimit())
      homeMaxPerTx.should.be.bignumber.equal(await foreignBridgeFactory.homeMaxPerTx())
      owner.should.be.equal(await foreignBridgeFactory.foreignBridgeOwner())
      owner.should.be.equal(await foreignBridgeFactory.foreignBridgeProxyOwner())
      const [major, minor, patch] = await foreignBridgeFactory.getBridgeFactoryVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })
  })

  describe('#deployForeignBridge', async () => {
    let foreignBridgeFactory
    before(async () => {
      foreignBridgeFactory = await ForeignBridgeFactory.new()
      await foreignBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, foreignBridgeContract.address, requiredBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, owner)
    })

    it('should deploy a foreign bridge', async () => {
      let token = await ERC677BridgeToken.new("Some ERC20", "SMT_1", 18)

      const {logs} = await foreignBridgeFactory.deployForeignBridge(token.address)
      const {args} = getEventFromLogs(logs, 'ForeignBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._foreignBridge)
      ZERO_ADDRESS.should.not.be.equal(args._foreignValidators)
      ZERO_ADDRESS.should.not.be.equal(args._foreignToken)
      args._blockNumber.should.be.bignumber.gte(0)

      let foreignBridge = await ForeignBridge.at(args._foreignBridge)
      true.should.be.equal(await foreignBridge.isInitialized())
      args._foreignValidators.should.be.equal(await foreignBridge.validatorContract())
      token.address.should.be.equal(await foreignBridge.erc20token())
      args._foreignToken.should.be.equal(await foreignBridge.erc20token())
      const deployedAtBlock = await foreignBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await foreignBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await foreignBridge.gasPrice())
      maxPerTx.should.be.bignumber.equal(await foreignBridge.maxPerTx())
      homeDailyLimit.should.be.bignumber.equal(await foreignBridge.executionDailyLimit())
      homeMaxPerTx.should.be.bignumber.equal(await foreignBridge.executionMaxPerTx())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      bridgeMode.should.be.equal(await foreignBridge.getBridgeMode())
      const [major, minor, patch] = await foreignBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('should deploy a second foreign bridge using same factory', async () => {
      let token = await ERC677BridgeToken.new("Another ERC20", "SMT_2", 18)

      const {logs} = await foreignBridgeFactory.deployForeignBridge(token.address)
      const {args} = getEventFromLogs(logs, 'ForeignBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._foreignBridge)
      ZERO_ADDRESS.should.not.be.equal(args._foreignValidators)
      ZERO_ADDRESS.should.not.be.equal(args._foreignToken)
      args._blockNumber.should.be.bignumber.gte(0)

      let foreignBridge = await ForeignBridge.at(args._foreignBridge)
      true.should.be.equal(await foreignBridge.isInitialized())
      args._foreignValidators.should.be.equal(await foreignBridge.validatorContract())
      token.address.should.be.equal(await foreignBridge.erc20token())
      args._foreignToken.should.be.equal(await foreignBridge.erc20token())
      const deployedAtBlock = await foreignBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await foreignBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await foreignBridge.gasPrice())
      maxPerTx.should.be.bignumber.equal(await foreignBridge.maxPerTx())
      homeDailyLimit.should.be.bignumber.equal(await foreignBridge.executionDailyLimit())
      homeMaxPerTx.should.be.bignumber.equal(await foreignBridge.executionMaxPerTx())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      bridgeMode.should.be.equal(await foreignBridge.getBridgeMode())
      const [major, minor, patch] = await foreignBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('should adjust the limits if token decimals are less than 18', async () => {
      let token = await ERC677BridgeToken.new("Another ERC20_3", "SMT_3", 2)

      const {logs} = await foreignBridgeFactory.deployForeignBridge(token.address)
      const {args} = getEventFromLogs(logs, 'ForeignBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._foreignBridge)
      ZERO_ADDRESS.should.not.be.equal(args._foreignValidators)
      ZERO_ADDRESS.should.not.be.equal(args._foreignToken)
      args._blockNumber.should.be.bignumber.gte(0)

      let foreignBridge = await ForeignBridge.at(args._foreignBridge)
      true.should.be.equal(await foreignBridge.isInitialized())
      args._foreignValidators.should.be.equal(await foreignBridge.validatorContract())
      token.address.should.be.equal(await foreignBridge.erc20token())
      args._foreignToken.should.be.equal(await foreignBridge.erc20token())
      const deployedAtBlock = await foreignBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await foreignBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await foreignBridge.gasPrice())
      '50'.should.be.bignumber.equal(await foreignBridge.maxPerTx())
      '100'.should.be.bignumber.equal(await foreignBridge.executionDailyLimit())
      '50'.should.be.bignumber.equal(await foreignBridge.executionMaxPerTx())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      bridgeMode.should.be.equal(await foreignBridge.getBridgeMode())
      const [major, minor, patch] = await foreignBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('should adjust the limits if token decimals are more than 18', async () => {
      let token = await ERC677BridgeToken.new("Another ERC20_4", "SMT_4", 24)

      const {logs} = await foreignBridgeFactory.deployForeignBridge(token.address)
      const {args} = getEventFromLogs(logs, 'ForeignBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._foreignBridge)
      ZERO_ADDRESS.should.not.be.equal(args._foreignValidators)
      ZERO_ADDRESS.should.not.be.equal(args._foreignToken)
      args._blockNumber.should.be.bignumber.gte(0)

      let foreignBridge = await ForeignBridge.at(args._foreignBridge)
      true.should.be.equal(await foreignBridge.isInitialized())
      args._foreignValidators.should.be.equal(await foreignBridge.validatorContract())
      token.address.should.be.equal(await foreignBridge.erc20token())
      args._foreignToken.should.be.equal(await foreignBridge.erc20token())
      const deployedAtBlock = await foreignBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await foreignBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await foreignBridge.gasPrice())
      '5e+23'.should.be.bignumber.equal(await foreignBridge.maxPerTx())
      '1e24'.should.be.bignumber.equal(await foreignBridge.executionDailyLimit())
      '5e+23'.should.be.bignumber.equal(await foreignBridge.executionMaxPerTx())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      bridgeMode.should.be.equal(await foreignBridge.getBridgeMode())
      const [major, minor, patch] = await foreignBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })
  })
})
