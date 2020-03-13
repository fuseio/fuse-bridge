const HomeBridgeFactory = artifacts.require("HomeBridgeFactory.sol")
const HomeBridge = artifacts.require("HomeBridgeErcToErc.sol")
const BridgeValidators = artifacts.require("BridgeValidators.sol")
const ERC677BridgeToken = artifacts.require("ERC677BridgeToken.sol")

const {ERROR_MSG, ZERO_ADDRESS, INVALID_ARGUMENTS} = require('../setup')
const {getEventFromLogs} = require('../helpers')
const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"))
const quarterEther = web3.toBigNumber(web3.toWei(0.25, "ether"))
const requiredSignatures = 1
const requiredBlockConfirmations = 8
const gasPrice = web3.toWei('1', 'gwei')
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"))
const homeDailyLimit = oneEther
const homeMaxPerTx = halfEther
const minPerTx = quarterEther
const foreignDailyLimit = oneEther
const foreignMaxPerTx = halfEther

contract('HomeBridgeFactory', async (accounts) => {
  let validatorContract, homeBridgeContract, owner
  before(async () => {
    validatorContract = await BridgeValidators.new()
    homeBridgeContract = await HomeBridge.new()
    owner = accounts[0],
    tokenOwner = accounts[1]
  })

  describe('#initialize', async () => {
    it('should initialize', async () => {
      let homeBridgeFactory = await HomeBridgeFactory.new()

      false.should.be.equal(await homeBridgeFactory.isInitialized())
      ZERO_ADDRESS.should.be.equal(await homeBridgeFactory.bridgeValidatorsImplementation())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.requiredSignatures())
      ZERO_ADDRESS.should.be.equal(await homeBridgeFactory.bridgeValidatorsOwner())
      ZERO_ADDRESS.should.be.equal(await homeBridgeFactory.bridgeValidatorsProxyOwner())
      ZERO_ADDRESS.should.be.equal(await homeBridgeFactory.homeBridgeErcToErcImplementation())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.requiredBlockConfirmations())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.gasPrice())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.homeDailyLimit())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.homeMaxPerTx())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.minPerTx())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.foreignDailyLimit())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.foreignMaxPerTx())
      ZERO_ADDRESS.should.be.equal(await homeBridgeFactory.homeBridgeOwner())
      ZERO_ADDRESS.should.be.equal(await homeBridgeFactory.homeBridgeProxyOwner())

      await homeBridgeFactory.initialize().should.be.rejectedWith(INVALID_ARGUMENTS)
      await homeBridgeFactory.initialize(ZERO_ADDRESS, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, ZERO_ADDRESS, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, 0, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], ZERO_ADDRESS, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, ZERO_ADDRESS, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, 0, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, 0, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, 0, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, 0, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, 0, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, 0, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignDailyLimit, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, ZERO_ADDRESS, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG)

      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner)

      true.should.be.equal(await homeBridgeFactory.isInitialized())
      validatorContract.address.should.be.equal(await homeBridgeFactory.bridgeValidatorsImplementation())
      requiredSignatures.should.be.bignumber.equal(await homeBridgeFactory.requiredSignatures())
      owner.should.be.equal(await homeBridgeFactory.bridgeValidatorsOwner())
      owner.should.be.equal(await homeBridgeFactory.bridgeValidatorsProxyOwner())
      homeBridgeContract.address.should.be.equal(await homeBridgeFactory.homeBridgeErcToErcImplementation())
      requiredBlockConfirmations.should.be.bignumber.equal(await homeBridgeFactory.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await homeBridgeFactory.gasPrice())
      homeDailyLimit.should.be.bignumber.equal(await homeBridgeFactory.homeDailyLimit())
      homeMaxPerTx.should.be.bignumber.equal(await homeBridgeFactory.homeMaxPerTx())
      minPerTx.should.be.bignumber.equal(await homeBridgeFactory.minPerTx())
      foreignDailyLimit.should.be.bignumber.equal(await homeBridgeFactory.foreignDailyLimit())
      foreignMaxPerTx.should.be.bignumber.equal(await homeBridgeFactory.foreignMaxPerTx())
      owner.should.be.equal(await homeBridgeFactory.homeBridgeOwner())
      owner.should.be.equal(await homeBridgeFactory.homeBridgeProxyOwner())
      const [major, minor, patch] = await homeBridgeFactory.getBridgeFactoryVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })
  })

  describe('#deployHomeBridge', async () => {
    let homeBridgeFactory
    before(async () => {
      homeBridgeFactory = await HomeBridgeFactory.new()
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner)
    })

    it('should deploy a home bridge', async () => {
      let token = { name: "Some ERC20", symbol: "SMT_1", decimals: 18 }

      const {logs} = await homeBridgeFactory.deployHomeBridge(token.name, token.symbol, token.decimals)
      const {args} = getEventFromLogs(logs, 'HomeBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._homeBridge)
      ZERO_ADDRESS.should.not.be.equal(args._homeValidators)
      ZERO_ADDRESS.should.not.be.equal(args._token)
      args._blockNumber.should.be.bignumber.gte(0)

      let homeBridge = await HomeBridge.at(args._homeBridge)
      true.should.be.equal(await homeBridge.isInitialized())
      args._homeValidators.should.be.equal(await homeBridge.validatorContract())
      const deployedAtBlock = await homeBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await homeBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await homeBridge.gasPrice())
      homeDailyLimit.should.be.bignumber.equal(await homeBridge.dailyLimit())
      homeMaxPerTx.should.be.bignumber.equal(await homeBridge.maxPerTx())
      minPerTx.should.be.bignumber.equal(await homeBridge.minPerTx())
      foreignDailyLimit.should.be.bignumber.equal(await homeBridge.executionDailyLimit())
      foreignMaxPerTx.should.be.bignumber.equal(await homeBridge.executionMaxPerTx())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      const mode = await homeBridge.getBridgeMode()
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await homeBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('should deploy a second home bridge using same factory', async () => {
      let token = { name: "Another ERC20", symbol: "SMT_2", decimals: 18 }

      const {logs} = await homeBridgeFactory.deployHomeBridge(token.name, token.symbol, token.decimals)
      const {args} = getEventFromLogs(logs, 'HomeBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._homeBridge)
      ZERO_ADDRESS.should.not.be.equal(args._homeValidators)
      ZERO_ADDRESS.should.not.be.equal(args._token)
      args._blockNumber.should.be.bignumber.gte(0)

      let homeBridge = await HomeBridge.at(args._homeBridge)
      true.should.be.equal(await homeBridge.isInitialized())
      args._homeValidators.should.be.equal(await homeBridge.validatorContract())
      const deployedAtBlock = await homeBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await homeBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await homeBridge.gasPrice())
      homeDailyLimit.should.be.bignumber.equal(await homeBridge.dailyLimit())
      homeMaxPerTx.should.be.bignumber.equal(await homeBridge.maxPerTx())
      minPerTx.should.be.bignumber.equal(await homeBridge.minPerTx())
      foreignDailyLimit.should.be.bignumber.equal(await homeBridge.executionDailyLimit())
      foreignMaxPerTx.should.be.bignumber.equal(await homeBridge.executionMaxPerTx())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      const mode = await homeBridge.getBridgeMode()
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await homeBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('should adjust the limits if token decimals are less than 18', async () => {
      let token = { name: "Another ERC20_3", symbol: "SMT_3", decimals: 2 }

      const {logs} = await homeBridgeFactory.deployHomeBridge(token.name, token.symbol, token.decimals)
      const {args} = getEventFromLogs(logs, 'HomeBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._homeBridge)
      ZERO_ADDRESS.should.not.be.equal(args._homeValidators)
      ZERO_ADDRESS.should.not.be.equal(args._token)
      args._blockNumber.should.be.bignumber.gte(0)

      let homeBridge = await HomeBridge.at(args._homeBridge)
      true.should.be.equal(await homeBridge.isInitialized())
      args._homeValidators.should.be.equal(await homeBridge.validatorContract())
      const deployedAtBlock = await homeBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await homeBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await homeBridge.gasPrice())
      '100'.should.be.bignumber.equal(await homeBridge.dailyLimit())
      '50'.should.be.bignumber.equal(await homeBridge.maxPerTx())
      '25'.should.be.bignumber.equal(await homeBridge.minPerTx())
      '100'.should.be.bignumber.equal(await homeBridge.executionDailyLimit())
      '50'.should.be.bignumber.equal(await homeBridge.executionMaxPerTx())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      const mode = await homeBridge.getBridgeMode()
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await homeBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('should adjust the limits if token decimals are more than 18', async () => {
      let token = { name: "Another ERC20_4", symbol: "SMT_4", decimals: 24 }

      const {logs} = await homeBridgeFactory.deployHomeBridge(token.name, token.symbol, token.decimals)
      const {args} = getEventFromLogs(logs, 'HomeBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._homeBridge)
      ZERO_ADDRESS.should.not.be.equal(args._homeValidators)
      ZERO_ADDRESS.should.not.be.equal(args._token)
      args._blockNumber.should.be.bignumber.gte(0)

      let homeBridge = await HomeBridge.at(args._homeBridge)
      true.should.be.equal(await homeBridge.isInitialized())
      args._homeValidators.should.be.equal(await homeBridge.validatorContract())
      const deployedAtBlock = await homeBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await homeBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await homeBridge.gasPrice())
      '1e24'.should.be.bignumber.equal(await homeBridge.dailyLimit())
      '5e23'.should.be.bignumber.equal(await homeBridge.maxPerTx())
      '25e22'.should.be.bignumber.equal(await homeBridge.minPerTx())
      '1e24'.should.be.bignumber.equal(await homeBridge.executionDailyLimit())
      '5e23'.should.be.bignumber.equal(await homeBridge.executionMaxPerTx())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      const mode = await homeBridge.getBridgeMode()
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await homeBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('should create token with correct agruments on deploy home bridge', async () => {
      let token = { name: "Some ERC20", symbol: "SMT_1", decimals: 18}

      const {logs} = await homeBridgeFactory.deployHomeBridge(token.name, token.symbol, token.decimals)
      const {args} = getEventFromLogs(logs, 'HomeBridgeDeployed')
      const bridgeToken = await ERC677BridgeToken.at(args._token)

      token.name.should.be.equal(await bridgeToken.name())
      token.symbol.should.be.equal(await bridgeToken.symbol())
      token.decimals.should.be.equal((await bridgeToken.decimals()).toNumber())
      owner.should.be.equal(await bridgeToken.owner())
      args._homeBridge.should.be.equal(await bridgeToken.bridgeContract())
    })

    it('the bridge owner cannot mint tokens', async () => {
      const user = accounts[2]
      let token = { name: "Some ERC20", symbol: "SMT_1", decimals: 18}

      const {logs} = await homeBridgeFactory.deployHomeBridge(token.name, token.symbol, token.decimals)
      const {args} = getEventFromLogs(logs, 'HomeBridgeDeployed')
      const bridgeToken = await ERC677BridgeToken.at(args._token)
      await bridgeToken.mint(user, oneEther, {from: tokenOwner}).should.not.be.fulfilled
    })
  })
  describe('#deployHomeBridgeWithToken', async () => {
    let homeBridgeFactory
    let bridgeToken
    before(async () => {
      homeBridgeFactory = await HomeBridgeFactory.new()
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner)
      bridgeToken = await ERC677BridgeToken.new("Test", "TST", 18);
    })

    it('should deploy a home bridge', async () => {
      await bridgeToken.addMinter(homeBridgeFactory.address);

      const {logs} = await homeBridgeFactory.deployHomeBridgeWithToken(bridgeToken.address)
      const {args} = getEventFromLogs(logs, 'HomeBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._homeBridge)
      ZERO_ADDRESS.should.not.be.equal(args._homeValidators)
      ZERO_ADDRESS.should.not.be.equal(args._token)
      args._blockNumber.should.be.bignumber.gte(0)

      let homeBridge = await HomeBridge.at(args._homeBridge)
      true.should.be.equal(await homeBridge.isInitialized())
      args._homeValidators.should.be.equal(await homeBridge.validatorContract())
      const deployedAtBlock = await homeBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await homeBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await homeBridge.gasPrice())
      homeDailyLimit.should.be.bignumber.equal(await homeBridge.dailyLimit())
      homeMaxPerTx.should.be.bignumber.equal(await homeBridge.maxPerTx())
      minPerTx.should.be.bignumber.equal(await homeBridge.minPerTx())
      foreignDailyLimit.should.be.bignumber.equal(await homeBridge.executionDailyLimit())
      foreignMaxPerTx.should.be.bignumber.equal(await homeBridge.executionMaxPerTx())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      const mode = await homeBridge.getBridgeMode()
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await homeBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('should deploy a second home bridge using same factory and new token', async () => {
      let newToken = await ERC677BridgeToken.new("Another ERC20", "SMT_2", 18);
      await newToken.addMinter(homeBridgeFactory.address);

      const {logs} = await homeBridgeFactory.deployHomeBridgeWithToken(newToken.address);
      const {args} = getEventFromLogs(logs, 'HomeBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._homeBridge)
      ZERO_ADDRESS.should.not.be.equal(args._homeValidators)
      ZERO_ADDRESS.should.not.be.equal(args._token)
      args._blockNumber.should.be.bignumber.gte(0)

      let homeBridge = await HomeBridge.at(args._homeBridge)
      true.should.be.equal(await homeBridge.isInitialized())
      args._homeValidators.should.be.equal(await homeBridge.validatorContract())
      const deployedAtBlock = await homeBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await homeBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await homeBridge.gasPrice())
      homeDailyLimit.should.be.bignumber.equal(await homeBridge.dailyLimit())
      homeMaxPerTx.should.be.bignumber.equal(await homeBridge.maxPerTx())
      minPerTx.should.be.bignumber.equal(await homeBridge.minPerTx())
      foreignDailyLimit.should.be.bignumber.equal(await homeBridge.executionDailyLimit())
      foreignMaxPerTx.should.be.bignumber.equal(await homeBridge.executionMaxPerTx())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      const mode = await homeBridge.getBridgeMode()
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await homeBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('should adjust the limits if token decimals are less then 18', async () => {
      let newToken = await ERC677BridgeToken.new("Another ERC20_3", "SMT_3", 2);
      await newToken.addMinter(homeBridgeFactory.address);

      const {logs} = await homeBridgeFactory.deployHomeBridgeWithToken(newToken.address);
      const {args} = getEventFromLogs(logs, 'HomeBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._homeBridge)
      ZERO_ADDRESS.should.not.be.equal(args._homeValidators)
      ZERO_ADDRESS.should.not.be.equal(args._token)
      args._blockNumber.should.be.bignumber.gte(0)

      let homeBridge = await HomeBridge.at(args._homeBridge)
      true.should.be.equal(await homeBridge.isInitialized())
      args._homeValidators.should.be.equal(await homeBridge.validatorContract())
      const deployedAtBlock = await homeBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await homeBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await homeBridge.gasPrice())
      '100'.should.be.bignumber.equal(await homeBridge.dailyLimit())
      '50'.should.be.bignumber.equal(await homeBridge.maxPerTx())
      '25'.should.be.bignumber.equal(await homeBridge.minPerTx())
      '100'.should.be.bignumber.equal(await homeBridge.executionDailyLimit())
      '50'.should.be.bignumber.equal(await homeBridge.executionMaxPerTx())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      const mode = await homeBridge.getBridgeMode()
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await homeBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('should adjust the limits if token decimals are more than 18', async () => {
      let newToken = await ERC677BridgeToken.new("Another ERC20_3", "SMT_3", 24);
      await newToken.addMinter(homeBridgeFactory.address);

      const {logs} = await homeBridgeFactory.deployHomeBridgeWithToken(newToken.address);
      const {args} = getEventFromLogs(logs, 'HomeBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._homeBridge)
      ZERO_ADDRESS.should.not.be.equal(args._homeValidators)
      ZERO_ADDRESS.should.not.be.equal(args._token)
      args._blockNumber.should.be.bignumber.gte(0)

      let homeBridge = await HomeBridge.at(args._homeBridge)
      true.should.be.equal(await homeBridge.isInitialized())
      args._homeValidators.should.be.equal(await homeBridge.validatorContract())
      const deployedAtBlock = await homeBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await homeBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await homeBridge.gasPrice())
      '1e24'.should.be.bignumber.equal(await homeBridge.dailyLimit())
      '5e23'.should.be.bignumber.equal(await homeBridge.maxPerTx())
      '25e22'.should.be.bignumber.equal(await homeBridge.minPerTx())
      '1e24'.should.be.bignumber.equal(await homeBridge.executionDailyLimit())
      '5e23'.should.be.bignumber.equal(await homeBridge.executionMaxPerTx())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      const mode = await homeBridge.getBridgeMode()
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await homeBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('should create token with correct agruments on deploy home bridge', async () => {
      let token = { name: "Some ERC20", symbol: "SMT_1", decimals: 18}
      let ercToken = await ERC677BridgeToken.new(token.name, token.symbol, token.decimals);
      await ercToken.addMinter(homeBridgeFactory.address);

      const {logs} = await homeBridgeFactory.deployHomeBridgeWithToken(ercToken.address);
      const {args} = getEventFromLogs(logs, 'HomeBridgeDeployed')
      const bridgeToken = await ERC677BridgeToken.at(args._token)

      token.name.should.be.equal(await bridgeToken.name())
      token.symbol.should.be.equal(await bridgeToken.symbol())
      token.decimals.should.be.equal((await bridgeToken.decimals()).toNumber())
      owner.should.be.equal(await bridgeToken.owner())
      args._homeBridge.should.be.equal(await bridgeToken.bridgeContract())
    })

    it('should not deploy home bridge if not minter of token', async () => {
      let token = { name: "Some ERC20", symbol: "SMT_1", decimals: 18}
      const bridgeToken = await ERC677BridgeToken.new(token.name, token.symbol, token.decimals);

      try {
        let error = await homeBridgeFactory.deployHomeBridgeWithToken(bridgeToken.address)
      }
      catch(error)
      {
        let condition = (
          error.message.search('VM Exception while processing transaction: revert Must be minter of token') > -1
        );
        assert.isTrue(condition, 'Expected revert VM Exception, got this instead: \n ' + error.message);
      }
    })

    it('should not allow non owner of token to deploy bridge', async () => {
      let token = { name: "Some ERC20", symbol: "SMT_1", decimals: 18}
      const bridgeToken = await ERC677BridgeToken.new(token.name, token.symbol, token.decimals);

      try {
        let error = await homeBridgeFactory.deployHomeBridgeWithToken(bridgeToken.address)
      }
      catch(error)
      {
        let condition = (
          error.message.search('VM Exception while processing transaction: revert Must be minter of token') > -1
        );
        assert.isTrue(condition, 'Expected revert VM Exception, got this instead: \n ' + error.message);
      }
    })
  })
})
