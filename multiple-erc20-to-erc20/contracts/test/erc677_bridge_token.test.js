const Web3Utils = require('web3-utils')
const ethUtils = require('ethereumjs-util')
const truffleAssert = require('truffle-assertions')

const ERC677BridgeToken = artifacts.require("ERC677BridgeToken.sol")
const ERC677ReceiverTest = artifacts.require("ERC677ReceiverTest.sol")
const TransferManagerTest = artifacts.require("TransferManagerTest.sol")
const HomeErcToErcBridge = artifacts.require("HomeBridgeErcToErc.sol")
const ForeignErcToErcBridge = artifacts.require("ForeignBridgeErcToErc.sol")
const BridgeValidators = artifacts.require("BridgeValidators.sol")

const { ERROR_MSG, ZERO_ADDRESS } = require('./setup')
const { toBufferStripPrefix } = require('./helpers')

const minPerTx = web3.toBigNumber(web3.toWei(0.01, "ether"))
const requireBlockConfirmations = 8
const gasPrice = Web3Utils.toWei('1', 'gwei')
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"))
const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"))
const executionDailyLimit = oneEther
const executionMaxPerTx = halfEther

contract('ERC677BridgeToken', async (accounts) => {
  let token
  let owner = accounts[0]
  const user = accounts[1]
  const tokenContract = ERC677BridgeToken;
  beforeEach(async () => {
    token = await tokenContract.new("Fuse Network Token", "FUSE", 18)
  })
  it('default values', async () => {
    const symbol = await token.symbol()
    assert.equal(symbol, 'FUSE')

    const decimals = await token.decimals()
    assert.equal(decimals, 18)

    const name = await token.name()
    assert.equal(name, "Fuse Network Token")

    const totalSupply = await token.totalSupply()
    assert.equal(totalSupply, 0)

    assert.equal(await token.owner(), owner)

    assert.isOk(await token.isMinter(owner))

    const [major, minor, patch] = await token.getTokenInterfacesVersion()
    major.should.be.bignumber.gte(0)
    minor.should.be.bignumber.gte(0)
    patch.should.be.bignumber.gte(0)
  })

  describe('#bridgeContract', async() => {
    it('can set bridge contract', async () => {
      const homeErcToErcContract = await HomeErcToErcBridge.new();

      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;

      (await token.bridgeContract()).should.be.equal(homeErcToErcContract.address);
    })

    it('only owner can set bridge contract', async () => {
      const homeErcToErcContract = await HomeErcToErcBridge.new();

      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(homeErcToErcContract.address, {from: user }).should.be.rejectedWith(ERROR_MSG);
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(homeErcToErcContract.address, {from: owner }).should.be.fulfilled;
      (await token.bridgeContract()).should.be.equal(homeErcToErcContract.address);
    })

    it('fail to set invalid bridge contract address', async () => {
      const invalidContractAddress = '0xaaB52d66283F7A1D5978bcFcB55721ACB467384b';

      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(invalidContractAddress).should.be.rejectedWith(ERROR_MSG);
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG);
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);
    })
  })

  describe('#transferManager', async() => {
    let transferManagerContract

    beforeEach(async () => {
      transferManagerContract = await TransferManagerTest.new();
    })

    it('can set transfer manager contract', async () => {
      (await token.transferManager()).should.be.equal(ZERO_ADDRESS);

      const tx = await token.setTransferManager(transferManagerContract.address).should.be.fulfilled;
      truffleAssert.eventEmitted(tx, 'TransferManagerSet');

      (await token.transferManager()).should.be.equal(transferManagerContract.address);
    })

    it('only minter can set transfer manager contract', async () => {
      (await token.transferManager()).should.be.equal(ZERO_ADDRESS);

      await token.setTransferManager(transferManagerContract.address, {from: user }).should.be.rejectedWith(ERROR_MSG);
      (await token.transferManager()).should.be.equal(ZERO_ADDRESS);

      await token.setTransferManager(transferManagerContract.address, {from: owner }).should.be.fulfilled;
      (await token.transferManager()).should.be.equal(transferManagerContract.address);
    })

    it('fail to set invalid transfer manager contract address', async () => {
      const invalidContractAddress = '0xaaB52d66283F7A1D5978bcFcB55721ACB467384b';
      (await token.transferManager()).should.be.equal(ZERO_ADDRESS);

      await token.setTransferManager(invalidContractAddress).should.be.rejectedWith(ERROR_MSG);
      (await token.transferManager()).should.be.equal(ZERO_ADDRESS);

      await token.setTransferManager(ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG);
      (await token.transferManager()).should.be.equal(ZERO_ADDRESS);
    })

    it('can set transfer manager contract', async () => {
      (await token.transferManager()).should.be.equal(ZERO_ADDRESS);

      await token.setTransferManager(transferManagerContract.address).should.be.fulfilled;

      (await token.transferManager()).should.be.equal(transferManagerContract.address);
    })
  })

  describe('#mint', async() => {
    it('can mint by owner', async () => {
      (await token.totalSupply()).should.be.bignumber.equal(0);
      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      (await token.totalSupply()).should.be.bignumber.equal(1);
      (await token.balanceOf(user)).should.be.bignumber.equal(1);
    })

    it('cannot mint by non-owner', async () => {
      (await token.totalSupply()).should.be.bignumber.equal(0);
      await token.mint(user, 1, {from: user }).should.be.rejectedWith(ERROR_MSG);
      (await token.totalSupply()).should.be.bignumber.equal(0);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
    })
  })

  describe('#transfer', async() => {
    let homeErcToErcContract, foreignErcToErcBridge, validatorContract
    beforeEach(async () => {
      validatorContract = await BridgeValidators.new();
      const authorities = [accounts[2]];
      await validatorContract.initialize(1, authorities, owner);
      homeErcToErcContract = await HomeErcToErcBridge.new();
      await homeErcToErcContract.initialize(validatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, token.address, executionDailyLimit, executionMaxPerTx, owner);
      foreignErcToErcBridge = await ForeignErcToErcBridge.new();
      await foreignErcToErcBridge.initialize(validatorContract.address, token.address, requireBlockConfirmations, gasPrice, oneEther, executionDailyLimit, executionMaxPerTx, owner);
    })
    it('sends tokens to recipient', async () => {
      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      await token.transfer(user, 1, {from: owner}).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await token.transfer(owner, 1, {from: user}).should.be.fulfilled;
      (await token.balanceOf(owner)).should.be.bignumber.equal(1);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
      logs[0].event.should.be.equal("Transfer");
      logs[0].args.should.be.deep.equal({
        from: user,
        to: owner,
        value: new web3.BigNumber(1)
      });
    })

    it('sends tokens to bridge contract', async () => {
      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.mint(user, web3.toWei(1, "ether"), {from: owner }).should.be.fulfilled;

      const result = await token.transfer(homeErcToErcContract.address, minPerTx, {from: user}).should.be.fulfilled;
      result.logs[0].event.should.be.equal("Transfer");
      result.logs[0].args.should.be.deep.equal({
        from: user,
        to: homeErcToErcContract.address,
        value: minPerTx
      });

      await token.setBridgeContract(foreignErcToErcBridge.address).should.be.fulfilled;
      const result2 = await token.transfer(foreignErcToErcBridge.address, minPerTx, {from: user}).should.be.fulfilled;
      result2.logs[0].event.should.be.equal("Transfer");
      result2.logs[0].args.should.be.deep.equal({
        from: user,
        to: foreignErcToErcBridge.address,
        value: minPerTx
      });
    })

    it('sends tokens to contract that does not contains onTokenTransfer method', async () => {
      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.mint(user, web3.toWei(1, "ether"), {from: owner }).should.be.fulfilled;

      const result = await token.transfer(validatorContract.address, minPerTx, {from: user}).should.be.fulfilled;
      result.logs[0].event.should.be.equal("Transfer");
      result.logs[0].args.should.be.deep.equal({
        from: user,
        to: validatorContract.address,
        value: minPerTx
      });
      result.logs[1].event.should.be.equal("ContractFallbackCallFailed");
      result.logs[1].args.should.be.deep.equal({
        from: user,
        to: validatorContract.address,
        value: minPerTx
      });
    })

    describe('#withTransferManager', () => {
      beforeEach(async () => {
        const transferManagerContract = await TransferManagerTest.new();
        await token.setTransferManager(transferManagerContract.address, {from: owner }).should.be.fulfilled;
        (await token.transferManager()).should.be.equal(transferManagerContract.address);
      })

      it('can transer less than 1000 ether', async () => {
        const amount = web3.toWei(1, "ether");
        await token.mint(user, amount, {from: owner }).should.be.fulfilled;
        await token.transfer(user, amount, {from: user}).should.be.fulfilled;
      })

      it('cannot transer more than 1000 ether', async () => {
        const amount = web3.toWei(1001, "ether");
        await token.mint(user, amount, {from: owner }).should.be.fulfilled;
        await token.transfer(user, amount, {from: user}).should.be.rejectedWith(ERROR_MSG);
      })
    })
  })

  describe("#burn", async () => {
    it('can burn', async() => {
      await token.burn(100, {from: owner}).should.be.rejectedWith(ERROR_MSG);
      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      await token.burn(1, {from: user}).should.be.fulfilled;
      (await token.totalSupply()).should.be.bignumber.equal(0);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
    })
  })

  describe('#transferAndCall', () => {
    let homeErcToErcContract, foreignErcToErcBridge, validatorContract
    beforeEach(async () => {
      validatorContract = await BridgeValidators.new();
      const authorities = [accounts[2]];
      await validatorContract.initialize(1, authorities, owner);
      homeErcToErcContract = await HomeErcToErcBridge.new();
      await homeErcToErcContract.initialize(validatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, token.address, executionDailyLimit, executionMaxPerTx, owner);
      foreignErcToErcBridge = await ForeignErcToErcBridge.new();
      await foreignErcToErcBridge.initialize(validatorContract.address, token.address, requireBlockConfirmations, gasPrice, oneEther, executionDailyLimit, executionMaxPerTx, owner);
    })
    it('calls contractFallback', async () => {
      const receiver = await ERC677ReceiverTest.new();
      (await receiver.from()).should.be.equal(ZERO_ADDRESS);
      (await receiver.value()).should.be.bignumber.equal('0');
      (await receiver.data()).should.be.equal('0x');
      (await receiver.someVar()).should.be.bignumber.equal('0');

      var ERC677ReceiverTestWeb3 = web3.eth.contract(ERC677ReceiverTest.abi);
      var ERC677ReceiverTestWeb3Instance = ERC677ReceiverTestWeb3.at(receiver.address);
      var callDoSomething123 = ERC677ReceiverTestWeb3Instance.doSomething.getData(123);

      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      await token.transferAndCall(token.address, 1, callDoSomething123, {from: user}).should.be.rejectedWith(ERROR_MSG);
      await token.transferAndCall(ZERO_ADDRESS, 1, callDoSomething123, {from: user}).should.be.rejectedWith(ERROR_MSG);
      await token.transferAndCall(receiver.address, 1, callDoSomething123, {from: user}).should.be.fulfilled;
      (await token.balanceOf(receiver.address)).should.be.bignumber.equal(1);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
      (await receiver.from()).should.be.equal(user);
      (await receiver.value()).should.be.bignumber.equal(1);
      (await receiver.data()).should.be.equal(callDoSomething123);
      (await receiver.someVar()).should.be.bignumber.equal('123');
    })

    it('sends tokens to bridge contract', async () => {
      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.mint(user, web3.toWei(1, "ether"), {from: owner }).should.be.fulfilled;

      const result = await token.transferAndCall(homeErcToErcContract.address, minPerTx, '0x', {from: user}).should.be.fulfilled;
      result.logs[0].event.should.be.equal("Transfer");
      result.logs[0].args.should.be.deep.equal({
        from: user,
        to: homeErcToErcContract.address,
        value: minPerTx
      });

      await token.setBridgeContract(foreignErcToErcBridge.address).should.be.fulfilled;
      const result2 = await token.transferAndCall(foreignErcToErcBridge.address, minPerTx, '0x', {from: user}).should.be.fulfilled;
      result2.logs[0].event.should.be.equal("Transfer");
      result2.logs[0].args.should.be.deep.equal({
        from: user,
        to: foreignErcToErcBridge.address,
        value: minPerTx
      });
    })

    it('fail to sends tokens to contract that does not contains onTokenTransfer method', async () => {
      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.mint(user, web3.toWei(1, "ether"), {from: owner }).should.be.fulfilled;

      await token.transferAndCall(validatorContract.address, minPerTx, '0x', {from: user}).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe('#claimtokens', async () => {
    it('can take send ERC20 tokens', async ()=> {
      const owner = accounts[0];
      const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
      let tokenSecond = await tokenContract.new("Roman Token", "RST", 18);

      await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled;
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]));
      await tokenSecond.transfer(token.address, halfEther);
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]));
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(token.address));

      await token.claimTokens(tokenSecond.address, accounts[3], {from: owner});
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(token.address));
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[3]));
    })
  })

  describe('#transfer', async () => {
    it('if transfer called on contract, onTokenTransfer is also invoked', async () => {
      const receiver = await ERC677ReceiverTest.new();
      (await receiver.from()).should.be.equal(ZERO_ADDRESS);
      (await receiver.value()).should.be.bignumber.equal('0');
      (await receiver.data()).should.be.equal('0x');
      (await receiver.someVar()).should.be.bignumber.equal('0');

      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      const {logs} = await token.transfer(receiver.address, 1, {from: user}).should.be.fulfilled;

      (await token.balanceOf(receiver.address)).should.be.bignumber.equal(1);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
      (await receiver.from()).should.be.equal(user);
      (await receiver.value()).should.be.bignumber.equal(1);
      (await receiver.data()).should.be.equal('0x');
      logs[0].event.should.be.equal("Transfer");
    })
    it('if transfer called on contract, still works even if onTokenTransfer doesnot exist', async () => {
      const someContract = await tokenContract.new("Some", "Token", 18);
      await token.mint(user, 2, {from: owner }).should.be.fulfilled;
      const tokenTransfer = await token.transfer(someContract.address, 1, {from: user}).should.be.fulfilled;
      const tokenTransfer2 = await token.transfer(accounts[0], 1, {from: user}).should.be.fulfilled;
      (await token.balanceOf(someContract.address)).should.be.bignumber.equal(1);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
      tokenTransfer.logs[0].event.should.be.equal("Transfer");
      tokenTransfer2.logs[0].event.should.be.equal("Transfer");
    })
  })

  describe('#transferPreSigned', async () => {
    const alice = accounts[10];  // has no ETH
    const alicePrivateKey = toBufferStripPrefix('0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501210');
    const bob = accounts[9];     // has 1M ETH
    const charlie = accounts[8]; // has 1M ETH

    const _fee = 0.1;
    const _amount = 0.9;

    const fee = web3.toBigNumber(web3.toWei(_fee, "ether"));
    const halfFee = web3.toBigNumber(web3.toWei(_fee/2, "ether"));
    const amount = web3.toBigNumber(web3.toWei(_amount, "ether"));
    const halfAmount = web3.toBigNumber(web3.toWei(_amount/2, "ether"));
    const total = web3.toBigNumber(web3.toWei(_fee + _amount, "ether"));

    beforeEach(async () => {
      await token.mint(alice, total, {from: owner }).should.be.fulfilled;
    })

    it('Send tokens to recipient and pay gas in tokens to 3rd party', async () => {
      const timestamp = +new Date();

      (await token.balanceOf(alice)).should.be.bignumber.equal(total);
      (await token.balanceOf(bob)).should.be.bignumber.equal(0);
      (await token.balanceOf(charlie)).should.be.bignumber.equal(0);

      const msg = await token.getTransferPreSignedHash(token.address, bob, amount, fee, timestamp);
      const vrs = ethUtils.ecsign(toBufferStripPrefix(msg), alicePrivateKey);
      const sig = ethUtils.toRpcSig(vrs.v, vrs.r, vrs.s);
      const tx = await token.transferPreSigned(sig, bob, amount, fee, timestamp, {from: charlie});

      truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === bob && ev.value.toNumber() === amount.toNumber();
      });

      truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === charlie && ev.value.toNumber() === fee.toNumber();
      });

      truffleAssert.eventEmitted(tx, 'TransferPreSigned', (ev) => {
        return ev.from === alice && ev.to === bob && ev.delegate === charlie && ev.amount.toNumber() === amount.toNumber() && ev.fee.toNumber() === fee.toNumber();
      });

      (await token.balanceOf(alice)).should.be.bignumber.equal(0);
      (await token.balanceOf(bob)).should.be.bignumber.equal(amount);
      (await token.balanceOf(charlie)).should.be.bignumber.equal(fee);
    })

    it('Someone tries to replay transfer (using same values) and fails', async () => {
      const timestamp = +new Date();

      const msg = await token.getTransferPreSignedHash(token.address, bob, amount, fee, timestamp);
      const vrs = ethUtils.ecsign(toBufferStripPrefix(msg), alicePrivateKey);
      const sig = ethUtils.toRpcSig(vrs.v, vrs.r, vrs.s);
      try {
        const tx = await token.transferPreSigned(sig, bob, amount, fee, timestamp, {from: charlie});
        assert.equal(tx.receipt.status, '0x00');
      } catch (error) {}
    })

    it('If transferPreSigned called on contract, onTokenTransfer is also invoked', async () => {
      const timestamp = +new Date();

      const receiver = await ERC677ReceiverTest.new();
      (await receiver.from()).should.be.equal(ZERO_ADDRESS);
      (await receiver.value()).should.be.bignumber.equal('0');
      (await receiver.data()).should.be.equal('0x');
      (await receiver.someVar()).should.be.bignumber.equal('0');

      const msg = await token.getTransferPreSignedHash(token.address, receiver.address, amount, fee, timestamp);
      const vrs = ethUtils.ecsign(toBufferStripPrefix(msg), alicePrivateKey);
      const sig = ethUtils.toRpcSig(vrs.v, vrs.r, vrs.s);
      const tx = await token.transferPreSigned(sig, receiver.address, amount, fee, timestamp, {from: charlie});

      truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === receiver.address && ev.value.toNumber() === amount.toNumber();
      });

      truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === charlie && ev.value.toNumber() === fee.toNumber();
      });

      truffleAssert.eventEmitted(tx, 'TransferPreSigned', (ev) => {
        return ev.from === alice && ev.to === receiver.address && ev.delegate === charlie && ev.amount.toNumber() === amount.toNumber() && ev.fee.toNumber() === fee.toNumber();
      });

      (await token.balanceOf(receiver.address)).should.be.bignumber.equal(amount);
      (await token.balanceOf(alice)).should.be.bignumber.equal(0);
      (await receiver.from()).should.be.equal(alice);
      (await receiver.value()).should.be.bignumber.equal(amount);
      (await receiver.data()).should.be.equal('0x');
      (await token.balanceOf(charlie)).should.be.bignumber.equal(fee);
    })

    it('If transferPreSigned called on contract, still works even if onTokenTransfer does not exist', async () => {
      const timestamp = +new Date();

      const someContract = await tokenContract.new("Some", "Token", 18);

      const msg1 = await token.getTransferPreSignedHash(token.address, someContract.address, halfAmount, halfFee, timestamp);
      const vrs1 = ethUtils.ecsign(toBufferStripPrefix(msg1), alicePrivateKey);
      const sig1 = ethUtils.toRpcSig(vrs1.v, vrs1.r, vrs1.s);
      const tx1 = await token.transferPreSigned(sig1, someContract.address, halfAmount, halfFee, timestamp, {from: charlie});

      const msg2 = await token.getTransferPreSignedHash(token.address, accounts[0], halfAmount, halfFee, timestamp);
      const vrs2 = ethUtils.ecsign(toBufferStripPrefix(msg2), alicePrivateKey);
      const sig2 = ethUtils.toRpcSig(vrs2.v, vrs2.r, vrs2.s);
      const tx2 = await token.transferPreSigned(sig2, accounts[0], halfAmount, halfFee, timestamp, {from: charlie});

      truffleAssert.eventEmitted(tx1, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === someContract.address && ev.value.toNumber() === halfAmount.toNumber();
      });

      truffleAssert.eventEmitted(tx1, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === charlie && ev.value.toNumber() === halfFee.toNumber();
      });

      truffleAssert.eventEmitted(tx1, 'TransferPreSigned', (ev) => {
        return ev.from === alice && ev.to === someContract.address && ev.delegate === charlie && ev.amount.toNumber() === halfAmount.toNumber() && ev.fee.toNumber() === halfFee.toNumber();
      });

      truffleAssert.eventEmitted(tx2, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === accounts[0] && ev.value.toNumber() === halfAmount.toNumber();
      });

      truffleAssert.eventEmitted(tx2, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === charlie && ev.value.toNumber() === halfFee.toNumber();
      });

      truffleAssert.eventEmitted(tx2, 'TransferPreSigned', (ev) => {
        return ev.from === alice && ev.to === accounts[0] && ev.delegate === charlie && ev.amount.toNumber() === halfAmount.toNumber() && ev.fee.toNumber() === halfFee.toNumber();
      });

      (await token.balanceOf(someContract.address)).should.be.bignumber.equal(halfAmount);
      (await token.balanceOf(alice)).should.be.bignumber.equal(0);
    })
  })

  describe('#transferAndCallPreSigned', async () => {
    const alice = accounts[10];  // has no ETH
    const alicePrivateKey = toBufferStripPrefix('0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501210');
    const bob = accounts[9];     // has 1M ETH
    const charlie = accounts[8]; // has 1M ETH

    const _fee = 0.1;
    const _amount = 0.9;

    const fee = web3.toBigNumber(web3.toWei(_fee, "ether"));
    const halfFee = web3.toBigNumber(web3.toWei(_fee/2, "ether"));
    const amount = web3.toBigNumber(web3.toWei(_amount, "ether"));
    const halfAmount = web3.toBigNumber(web3.toWei(_amount/2, "ether"));
    const total = web3.toBigNumber(web3.toWei(_fee + _amount, "ether"));

    let homeErcToErcContract, foreignErcToErcBridge, validatorContract;

    beforeEach(async () => {
      await token.mint(alice, total, {from: owner }).should.be.fulfilled;
      validatorContract = await BridgeValidators.new();
      const authorities = [accounts[2]];
      await validatorContract.initialize(1, authorities, owner);
      homeErcToErcContract = await HomeErcToErcBridge.new();
      await homeErcToErcContract.initialize(validatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, token.address, executionDailyLimit, executionMaxPerTx, owner);
      foreignErcToErcBridge = await ForeignErcToErcBridge.new();
      await foreignErcToErcBridge.initialize(validatorContract.address, token.address, requireBlockConfirmations, gasPrice, oneEther, executionDailyLimit, executionMaxPerTx, owner);
    })

    it('calls contractFallback', async () => {
      const timestamp = +new Date();

      const receiver = await ERC677ReceiverTest.new();
      (await receiver.from()).should.be.equal(ZERO_ADDRESS);
      (await receiver.value()).should.be.bignumber.equal('0');
      (await receiver.data()).should.be.equal('0x');
      (await receiver.someVar()).should.be.bignumber.equal('0');

      var ERC677ReceiverTestWeb3 = web3.eth.contract(ERC677ReceiverTest.abi);
      var ERC677ReceiverTestWeb3Instance = ERC677ReceiverTestWeb3.at(receiver.address);
      var callDoSomething123 = ERC677ReceiverTestWeb3Instance.doSomething.getData(123);

      let msg = await token.getTransferAndCallPreSignedHash(token.address, token.address, amount, callDoSomething123, fee, timestamp);
      let vrs = ethUtils.ecsign(toBufferStripPrefix(msg), alicePrivateKey);
      let sig = ethUtils.toRpcSig(vrs.v, vrs.r, vrs.s);
      await token.transferAndCallPreSigned(sig, token.address, amount, callDoSomething123, fee, timestamp, {from: charlie}).should.be.rejectedWith(ERROR_MSG);

      msg = await token.getTransferAndCallPreSignedHash(token.address, ZERO_ADDRESS, amount, callDoSomething123, fee, timestamp);
      vrs = ethUtils.ecsign(toBufferStripPrefix(msg), alicePrivateKey);
      sig = ethUtils.toRpcSig(vrs.v, vrs.r, vrs.s);
      await token.transferAndCallPreSigned(sig, ZERO_ADDRESS, amount, callDoSomething123, fee, timestamp, {from: charlie}).should.be.rejectedWith(ERROR_MSG);

      msg = await token.getTransferAndCallPreSignedHash(token.address, receiver.address, amount, callDoSomething123, fee, timestamp);
      vrs = ethUtils.ecsign(toBufferStripPrefix(msg), alicePrivateKey);
      sig = ethUtils.toRpcSig(vrs.v, vrs.r, vrs.s);
      const tx = await token.transferAndCallPreSigned(sig, receiver.address, amount, callDoSomething123, fee, timestamp, {from: charlie});

      truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === receiver.address && ev.value.toNumber() === amount.toNumber();
      });

      truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === charlie && ev.value.toNumber() === fee.toNumber();
      });

      truffleAssert.eventEmitted(tx, 'TransferAndCallPreSigned', (ev) => {
        return ev.from === alice && ev.to === receiver.address && ev.delegate === charlie && ev.amount.toNumber() === amount.toNumber() && ev.data === callDoSomething123 && ev.fee.toNumber() === fee.toNumber();
      });

      (await token.balanceOf(receiver.address)).should.be.bignumber.equal(amount);
      (await token.balanceOf(alice)).should.be.bignumber.equal(0);
      (await receiver.from()).should.be.equal(alice);
      (await receiver.value()).should.be.bignumber.equal(amount);
      (await receiver.data()).should.be.equal(callDoSomething123);
      (await receiver.someVar()).should.be.bignumber.equal('123');
    })

    it('sends tokens to bridge contract', async () => {
      const timestamp = +new Date();

      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      const msg1 = await token.getTransferAndCallPreSignedHash(token.address, homeErcToErcContract.address, halfAmount, '0x', halfFee, timestamp);
      const vrs1 = ethUtils.ecsign(toBufferStripPrefix(msg1), alicePrivateKey);
      const sig1 = ethUtils.toRpcSig(vrs1.v, vrs1.r, vrs1.s);
      const tx1 = await token.transferAndCallPreSigned(sig1, homeErcToErcContract.address, halfAmount, '0x', halfFee, timestamp, {from: charlie});
      truffleAssert.eventEmitted(tx1, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === homeErcToErcContract.address && ev.value.toNumber() === halfAmount.toNumber();
      });

      truffleAssert.eventEmitted(tx1, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === charlie && ev.value.toNumber() === halfFee.toNumber();
      });

      truffleAssert.eventEmitted(tx1, 'TransferAndCallPreSigned', (ev) => {
        return ev.from === alice && ev.to === homeErcToErcContract.address && ev.delegate === charlie && ev.amount.toNumber() === halfAmount.toNumber() && ev.data === '0x' && ev.fee.toNumber() === halfFee.toNumber();
      });

      await token.setBridgeContract(foreignErcToErcBridge.address).should.be.fulfilled;
      const msg2 = await token.getTransferAndCallPreSignedHash(token.address, foreignErcToErcBridge.address, halfAmount, '0x', halfFee, timestamp);
      const vrs2 = ethUtils.ecsign(toBufferStripPrefix(msg2), alicePrivateKey);
      const sig2 = ethUtils.toRpcSig(vrs2.v, vrs2.r, vrs2.s);
      const tx2 = await token.transferAndCallPreSigned(sig2, foreignErcToErcBridge.address, halfAmount, '0x', halfFee, timestamp, {from: charlie});
      truffleAssert.eventEmitted(tx2, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === foreignErcToErcBridge.address && ev.value.toNumber() === halfAmount.toNumber();
      });

      truffleAssert.eventEmitted(tx2, 'Transfer', (ev) => {
        return ev.from === alice && ev.to === charlie && ev.value.toNumber() === halfFee.toNumber();
      });

      truffleAssert.eventEmitted(tx2, 'TransferAndCallPreSigned', (ev) => {
        return ev.from === alice && ev.to === foreignErcToErcBridge.address && ev.delegate === charlie && ev.amount.toNumber() === halfAmount.toNumber() && ev.data === '0x' && ev.fee.toNumber() === halfFee.toNumber();
      })
    })

    it('fails to sends tokens to contract that does not contains onTokenTransfer method', async () => {
      const timestamp = +new Date();

      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      const msg2 = await token.getTransferAndCallPreSignedHash(token.address, validatorContract.address, amount, '0x', fee, timestamp);
      const vrs = ethUtils.ecsign(toBufferStripPrefix(msg2), alicePrivateKey);
      const sig = ethUtils.toRpcSig(vrs.v, vrs.r, vrs.s);
      await token.transferAndCallPreSigned(sig, validatorContract.address, amount, '0x', fee, timestamp, {from: charlie}).should.be.rejectedWith(ERROR_MSG);
    })

    it('fails to send tokens to bridge contract out of limits', async () => {
      const timestamp = +new Date();
      const lessThanMin = web3.toBigNumber(web3.toWei(0.0001, "ether"));

      let msg = await token.getTransferAndCallPreSignedHash(token.address, homeErcToErcContract.address, lessThanMin, '0x', fee, timestamp);
      let vrs = ethUtils.ecsign(toBufferStripPrefix(msg), alicePrivateKey);
      let sig = ethUtils.toRpcSig(vrs.v, vrs.r, vrs.s);
      await token.transferAndCallPreSigned(sig, homeErcToErcContract.address, lessThanMin, '0x', fee, timestamp, {from: charlie}).should.be.rejectedWith(ERROR_MSG);

      await token.setBridgeContract(foreignErcToErcBridge.address).should.be.fulfilled;
      msg = await token.getTransferAndCallPreSignedHash(token.address, ZERO_ADDRESS, lessThanMin, '0x', fee, timestamp);
      vrs = ethUtils.ecsign(toBufferStripPrefix(msg), alicePrivateKey);
      sig = ethUtils.toRpcSig(vrs.v, vrs.r, vrs.s);
      await token.transferAndCallPreSigned(sig, ZERO_ADDRESS, lessThanMin, '0x', fee, timestamp, {from: charlie}).should.be.rejectedWith(ERROR_MSG);
    })
  })
})
