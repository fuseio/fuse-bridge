const ForeignBridge = artifacts.require("ForeignBridgeNativeToErc.sol");
const ForeignBridgeV2 = artifacts.require("ForeignBridgeV2.sol");
const ForeignBridgeValidators = artifacts.require("ForeignBridgeValidatorsMock.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");

const POA20 = artifacts.require("ERC677BridgeToken.sol");
const {ERROR_MSG, ZERO_ADDRESS, ERROR_MSG_OPCODE} = require('../setup');
const {createMessage, createNewSetMessage, sign, signatureToVRS, strip0x} = require('../helpers');
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
const minPerTx = web3.toBigNumber(web3.toWei(0.01, "ether"));
const Web3Utils = require('web3-utils');
const requireBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');
const homeDailyLimit = oneEther
const homeMaxPerTx = halfEther
const erc677tokenPreMinted = false

const getEvents = function(contract, filter) {
  return new Promise((resolve, reject) => {
      var event = contract[filter.event]();
      event.watch();
      event.get((error, logs) => {
        if(logs.length > 0){
          resolve(logs);
        } else {
          throw Error("Failed to find filtered event for " + filter.event);
        }
      });
      event.stopWatching();
  });
}

contract('ForeignBridge_Native_to_ERC20', async (accounts) => {
  let validatorContract, authorities, owner, token;
  before(async () => {
    validatorContract = await ForeignBridgeValidators.new()
    authorities = [accounts[1], accounts[2]];
    owner = accounts[0]
    await validatorContract.initialize(authorities, owner)
    await validatorContract.setRequiredSignatures(1)
  })

  describe('#initialize', async () => {
    it('should initialize', async () => {
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      let foreignBridge =  await ForeignBridge.new();

      ZERO_ADDRESS.should.be.equal(await foreignBridge.validatorContract())
      '0'.should.be.bignumber.equal(await foreignBridge.deployedAtBlock())
      '0'.should.be.bignumber.equal(await foreignBridge.dailyLimit())
      '0'.should.be.bignumber.equal(await foreignBridge.maxPerTx())
      false.should.be.equal(await foreignBridge.isInitialized())

      await foreignBridge.initialize(ZERO_ADDRESS, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(validatorContract.address, ZERO_ADDRESS, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, 0, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(owner, token.address, oneEther, halfEther, minPerTx, requireBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(validatorContract.address, owner, oneEther, halfEther, minPerTx, requireBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted);

      true.should.be.equal(await foreignBridge.isInitialized())
      validatorContract.address.should.be.equal(await foreignBridge.validatorContract());
      (await foreignBridge.deployedAtBlock()).should.be.bignumber.above(0);
      oneEther.should.be.bignumber.equal(await foreignBridge.dailyLimit())
      halfEther.should.be.bignumber.equal(await foreignBridge.maxPerTx())
      minPerTx.should.be.bignumber.equal(await foreignBridge.minPerTx())
      const bridgeMode = '0x92a8d7fe' // 4 bytes of keccak256('native-to-erc-core')
      const mode = await foreignBridge.getBridgeMode();
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await foreignBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })
  })

  describe('#executeSignatures', async () => {
    beforeEach(async () => {
      foreignBridge = await ForeignBridge.new()
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
      const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted);
      oneEther.should.be.bignumber.equal(await foreignBridge.dailyLimit());

      await token.addMinter(foreignBridge.address);
      await token.renounceMinter();
    })
    it('should allow to deposit', async () => {
      var recipientAccount = accounts[3];
      const balanceBefore = await token.balanceOf(recipientAccount)
      const totalSupplyBefore = await token.totalSupply()
      var value = web3.toBigNumber(web3.toWei(0.25, "ether"));
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      const {logs} = await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      logs[0].event.should.be.equal("RelayedMessage")
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      logs[0].args.transactionHash.should.be.equal(transactionHash);

      const balanceAfter = await token.balanceOf(recipientAccount);
      const totalSupplyAfter = await token.totalSupply();
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore.add(value))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
    })
    it('should reject if address is not foreign address', async () => {
      var recipientAccount = accounts[3];
      const balanceBefore = await token.balanceOf(recipientAccount)
      const totalSupplyBefore = await token.totalSupply()
      var value = web3.toBigNumber(web3.toWei(0.25, "ether"));
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, accounts[0]);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.rejectedWith(ERROR_MSG)

    })
    it('should allow second deposit with different transactionHash but same recipient and value', async ()=> {
      var recipientAccount = accounts[3];
      const balanceBefore = await token.balanceOf(recipientAccount)
      // tx 1
      var value = web3.toBigNumber(web3.toWei(0.25, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      // tx 2
      var transactionHash2 = "0x77a496628a776a03d58d7e6059a5937f04bebd8ba4ff89f76dd4bb8ba7e291ee";
      var message2 = createMessage(recipientAccount, value, transactionHash2, foreignBridge.address);
      var signature2 = await sign(authorities[0], message2)
      var vrs2 = signatureToVRS(signature2);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash2))
      const {logs} = await foreignBridge.executeSignatures([vrs2.v], [vrs2.r], [vrs2.s], message2).should.be.fulfilled

      logs[0].event.should.be.equal("RelayedMessage")
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      logs[0].args.transactionHash.should.be.equal(transactionHash2);
      const totalSupply = await token.totalSupply()
      const balanceAfter = await token.balanceOf(recipientAccount)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.mul(2)))
      totalSupply.should.be.bignumber.equal(value.mul(2))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash2))
    })

    it('should not allow second deposit (replay attack) with same transactionHash but different recipient', async () => {
      var recipientAccount = accounts[3];
      const balanceBefore = await token.balanceOf(recipientAccount)
      // tx 1
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      // tx 2
      var message2 = createMessage(accounts[4], value, transactionHash, foreignBridge.address);
      var signature2 = await sign(authorities[0], message2)
      var vrs = signatureToVRS(signature2);
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message2).should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow withdraw over home max tx limit', async () => {
      const recipientAccount = accounts[3];
      const invalidValue = web3.toBigNumber(web3.toWei(0.75, "ether"));

      const transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      const message = createMessage(recipientAccount, invalidValue, transactionHash, foreignBridge.address);
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature);

      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow withdraw over daily home limit', async () => {
      const recipientAccount = accounts[3];

      const transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      const message = createMessage(recipientAccount, halfEther, transactionHash, foreignBridge.address);
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature);

      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled

      const transactionHash2 = "0x69debd8fd1923c9cb3cd8ef6461e2740b2d037943b941729d5a47671a2bb8712";
      const message2 = createMessage(recipientAccount, halfEther, transactionHash2, foreignBridge.address);
      const signature2 = await sign(authorities[0], message2)
      const vrs2 = signatureToVRS(signature2);

      await foreignBridge.executeSignatures([vrs2.v], [vrs2.r], [vrs2.s], message2).should.be.fulfilled

      const transactionHash3 = "0x022695428093bb292db8e48bd1417c5e1b84c0bf673bd0fff23ed0fb6495b872";
      const message3 = createMessage(recipientAccount, halfEther, transactionHash3, foreignBridge.address);
      const signature3 = await sign(authorities[0], message3)
      const vrs3 = signatureToVRS(signature3);

      await foreignBridge.executeSignatures([vrs3.v], [vrs3.r], [vrs3.s], message3).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#executeSignatures with 2 minimum signatures', async () => {
    let multisigValidatorContract, twoAuthorities, ownerOfValidatorContract, foreignBridgeWithMultiSignatures
    beforeEach(async () => {
      multisigValidatorContract = await ForeignBridgeValidators.new()
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      twoAuthorities = [accounts[0], accounts[1]];
      ownerOfValidatorContract = accounts[3]
      const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
      await multisigValidatorContract.initialize(twoAuthorities, ownerOfValidatorContract, {from: ownerOfValidatorContract})
      foreignBridgeWithMultiSignatures = await ForeignBridge.new()
      const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
      await foreignBridgeWithMultiSignatures.initialize(multisigValidatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted, {from: ownerOfValidatorContract});
      await token.addMinter(foreignBridgeWithMultiSignatures.address);
      await token.renounceMinter();
    })
    it('deposit should fail if not enough signatures are provided', async () => {
      var recipientAccount = accounts[4];
      const balanceBefore = await web3.eth.getBalance(recipientAccount)
      const homeBalanceBefore = await web3.eth.getBalance(foreignBridgeWithMultiSignatures.address)
      // msg 1
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, foreignBridgeWithMultiSignatures.address);
      var signature = await sign(twoAuthorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))
      await foreignBridgeWithMultiSignatures.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.rejectedWith(ERROR_MSG)
      // msg 2
      var signature2 = await sign(twoAuthorities[1], message)
      var vrs2 = signatureToVRS(signature2);
      const {logs} = await foreignBridgeWithMultiSignatures.executeSignatures([vrs.v, vrs2.v], [vrs.r, vrs2.r], [vrs.s, vrs2.s], message).should.be.fulfilled;

      logs[0].event.should.be.equal("RelayedMessage")
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      logs[0].args.transactionHash.should.be.equal(transactionHash);
      const balanceAfter = await token.balanceOf(recipientAccount)
      true.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))

    })
    it('deposit should fail if duplicate signature is provided', async () => {
      var recipientAccount = accounts[4];
      const balanceBefore = await web3.eth.getBalance(recipientAccount)
      const homeBalanceBefore = await web3.eth.getBalance(foreignBridgeWithMultiSignatures.address)
      // msg 1
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, foreignBridgeWithMultiSignatures.address);
      var signature = await sign(twoAuthorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))
      await foreignBridgeWithMultiSignatures.executeSignatures([vrs.v, vrs.v], [vrs.r, vrs.r], [vrs.s, vrs.s], message).should.be.rejectedWith(ERROR_MSG)
    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipient = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      const validatorContractWith3Signatures = await ForeignBridgeValidators.new()
      await validatorContractWith3Signatures.initialize(authoritiesFiveAccs, ownerOfValidators)
      const erc20Token = await POA20.new("Some ERC20", "RSZT", 18);
      const value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      const foreignBridgeWithThreeSigs = await ForeignBridge.new()

      await foreignBridgeWithThreeSigs.initialize(validatorContractWith3Signatures.address, erc20Token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted);
      await erc20Token.addMinter(foreignBridgeWithThreeSigs.address);
      await erc20Token.renounceMinter();

      const txHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      const message = createMessage(recipient, value, txHash, foreignBridgeWithThreeSigs.address);

      // signature 1
      const signature = await sign(authoritiesFiveAccs[0], message)
      const vrs = signatureToVRS(signature);

      // signature 2
      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const vrs2 = signatureToVRS(signature2);

      // signature 3
      const signature3 = await sign(authoritiesFiveAccs[2], message)
      const vrs3 = signatureToVRS(signature3);


      const {logs} = await foreignBridgeWithThreeSigs.executeSignatures([vrs.v, vrs2.v, vrs3.v], [vrs.r, vrs2.r, vrs3.r], [vrs.s, vrs2.s, vrs3.s], message).should.be.fulfilled;
      logs[0].event.should.be.equal("RelayedMessage")
      logs[0].args.recipient.should.be.equal(recipient)
      logs[0].args.value.should.be.bignumber.equal(value)
      true.should.be.equal(await foreignBridgeWithThreeSigs.relayedMessages(txHash))
    })
  })

  describe('#executeSignatures when recipient is foreignBridge itself', function() {
    beforeEach(async () => {
      foreignBridge = await ForeignBridge.new()
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
      const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted);
      oneEther.should.be.bignumber.equal(await foreignBridge.dailyLimit());

      await token.addMinter(foreignBridge.address);
      await token.renounceMinter();
    })
    it('should allow to deposit', async () => {
      const recipientAccount = foreignBridge.address;
      const balanceBefore = await token.balanceOf(recipientAccount)
      const totalSupplyBefore = await token.totalSupply()
      var value = web3.toBigNumber(web3.toWei(0.25, "ether"));
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      const {logs} = await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      logs[0].event.should.be.equal("RelayedMessage")
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      logs[0].args.transactionHash.should.be.equal(transactionHash);

      const balanceAfter = await token.balanceOf(recipientAccount);
      const totalSupplyAfter = await token.totalSupply();
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore.add(value))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
    })
    it('should reject if address is not foreign address', async () => {
      const recipientAccount = foreignBridge.address;
      const balanceBefore = await token.balanceOf(recipientAccount)
      const totalSupplyBefore = await token.totalSupply()
      var value = web3.toBigNumber(web3.toWei(0.25, "ether"));
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(foreignBridge.address, value, transactionHash, accounts[0]);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.rejectedWith(ERROR_MSG)
    })
    it('should allow second deposit with different transactionHash but same recipient and value', async ()=> {
      const recipientAccount = foreignBridge.address;
      const balanceBefore = await token.balanceOf(recipientAccount)
      // tx 1
      var value = web3.toBigNumber(web3.toWei(0.25, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      // tx 2
      var transactionHash2 = "0x77a496628a776a03d58d7e6059a5937f04bebd8ba4ff89f76dd4bb8ba7e291ee";
      var message2 = createMessage(foreignBridge.address, value, transactionHash2, foreignBridge.address);
      var signature2 = await sign(authorities[0], message2)
      var vrs2 = signatureToVRS(signature2);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash2))
      const {logs} = await foreignBridge.executeSignatures([vrs2.v], [vrs2.r], [vrs2.s], message2).should.be.fulfilled

      logs[0].event.should.be.equal("RelayedMessage")
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      logs[0].args.transactionHash.should.be.equal(transactionHash2);
      const totalSupply = await token.totalSupply()
      const balanceAfter = await token.balanceOf(recipientAccount)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.mul(2)))
      totalSupply.should.be.bignumber.equal(value.mul(2))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash2))
    })
    it('should not allow second deposit (replay attack) with same transactionHash but different recipient', async () => {
      const recipientAccount = foreignBridge.address;
      const balanceBefore = await token.balanceOf(recipientAccount)
      // tx 1
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      // tx 2
      var message2 = createMessage(accounts[4], value, transactionHash, foreignBridge.address);
      var signature2 = await sign(authorities[0], message2)
      var vrs = signatureToVRS(signature2);
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message2).should.be.rejectedWith(ERROR_MSG)
    })
    it('should not allow withdraw over home max tx limit', async () => {
      const recipientAccount = foreignBridge.address;
      const invalidValue = web3.toBigNumber(web3.toWei(0.75, "ether"));

      const transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      const message = createMessage(foreignBridge.address, invalidValue, transactionHash, foreignBridge.address);
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature);

      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.rejectedWith(ERROR_MSG)
    })
    it('should allow withdraw over daily home limit', async () => {
      const recipientAccount = foreignBridge.address;

      const transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      const message = createMessage(foreignBridge.address, halfEther, transactionHash, foreignBridge.address);
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature);

      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled

      const transactionHash2 = "0x69debd8fd1923c9cb3cd8ef6461e2740b2d037943b941729d5a47671a2bb8712";
      const message2 = createMessage(foreignBridge.address, halfEther, transactionHash2, foreignBridge.address);
      const signature2 = await sign(authorities[0], message2)
      const vrs2 = signatureToVRS(signature2);

      await foreignBridge.executeSignatures([vrs2.v], [vrs2.r], [vrs2.s], message2).should.be.fulfilled

      const transactionHash3 = "0x022695428093bb292db8e48bd1417c5e1b84c0bf673bd0fff23ed0fb6495b872";
      const message3 = createMessage(foreignBridge.address, halfEther, transactionHash3, foreignBridge.address);
      const signature3 = await sign(authorities[0], message3)
      const vrs3 = signatureToVRS(signature3);

      await foreignBridge.executeSignatures([vrs3.v], [vrs3.r], [vrs3.s], message3).should.be.fulfilled
    })
  })

  describe('#executeNewSetSignatures', async () => {
    beforeEach(async () => {
      foreignBridge = await ForeignBridge.new();
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      validatorContract = await ForeignBridgeValidators.new();
      authorities = [accounts[1], accounts[2]];
      owner = accounts[0];
      await validatorContract.initialize(authorities, owner);
      await validatorContract.setRequiredSignatures(1);
      await validatorContract.setOwnerMock(foreignBridge.address);
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted);
    })
    it('should allow to update a new set', async () => {
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var blockNumber = web3.toBigNumber(217455)
      var message = createNewSetMessage([accounts[3], accounts[4]], transactionHash, blockNumber, foreignBridge.address);
      var signature = await sign(authorities[0], message);
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash));
      const {logs} = await foreignBridge.executeNewSetSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled;
      logs[0].event.should.be.equal("RelayedNewSetMessage");
      logs[0].args.transactionHash.should.be.equal(transactionHash);
      logs[0].args.newSet.should.be.deep.equal([accounts[3], accounts[4]]);
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash));
      (await validatorContract.validators()).should.be.deep.equal([accounts[3], accounts[4]])
    })
    it('should allow to update a new set if there are enough validator signatures even when some are from non-validators', async () => {
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var blockNumber = web3.toBigNumber(217455)
      var message = createNewSetMessage([accounts[3], accounts[4]], transactionHash, blockNumber, foreignBridge.address);
      var signature1 = await sign(authorities[0], message);
      var vrs1 = signatureToVRS(signature1);
      var signature2 = await sign(accounts[3], message);
      var vrs2 = signatureToVRS(signature2);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash));
      const {logs} = await foreignBridge.executeNewSetSignatures([vrs1.v, vrs2.v], [vrs1.r, vrs2.r], [vrs1.s, vrs2.s], message).should.be.fulfilled;
      logs[0].event.should.be.equal("RelayedNewSetMessage");
      logs[0].args.transactionHash.should.be.equal(transactionHash);
      logs[0].args.newSet.should.be.deep.equal([accounts[3], accounts[4]]);
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash));
      (await validatorContract.validators()).should.be.deep.equal([accounts[3], accounts[4]])
    })
    it('should not allow to update a new set with same transactionHash but different addresses', async () => {
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      // tx 1
      var blockNumber = web3.toBigNumber(217455)
      var message = createNewSetMessage([accounts[3], accounts[4]], transactionHash, blockNumber, foreignBridge.address);
      var signature = await sign(authorities[0], message);
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash));
      await foreignBridge.executeNewSetSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled;
      (await validatorContract.validators()).should.be.deep.equal([accounts[3], accounts[4]])

      // tx 2
      var blockNumber = web3.toBigNumber(217455)
      var message2 = createNewSetMessage([accounts[5]], transactionHash, blockNumber, foreignBridge.address);
      var signature2 = await sign(authorities[0], message2);
      var vrs2 = signatureToVRS(signature2);
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash));
      await foreignBridge.executeNewSetSignatures([vrs2.v], [vrs2.r], [vrs2.s], message2).should.be.rejectedWith(ERROR_MSG);
      (await validatorContract.validators()).should.be.deep.equal([accounts[3], accounts[4]])
    })
    it('should not allow to update a new set with signature from non-validator', async () => {
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var blockNumber = web3.toBigNumber(217455)
      var message = createNewSetMessage([accounts[3], accounts[4]], transactionHash, blockNumber, foreignBridge.address);
      var signature = await sign(accounts[3], message);
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash));
      await foreignBridge.executeNewSetSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.rejectedWith(ERROR_MSG);
      (await validatorContract.validators()).should.be.deep.equal([authorities[0], authorities[1]])
    })
    it('should not allow to update a new set with duplicate signatures', async () => {
      await validatorContract.setRequiredSignatures(2)
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var blockNumber = web3.toBigNumber(217455)
      var message = createNewSetMessage([accounts[3], accounts[4]], transactionHash, blockNumber, foreignBridge.address);
      var signature1 = await sign(authorities[0], message);
      var vrs1 = signatureToVRS(signature1);
      var signature2 = await sign(authorities[0], message);
      var vrs2 = signatureToVRS(signature2);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash));
      await foreignBridge.executeNewSetSignatures([vrs1.v, vrs2.v], [vrs1.r, vrs2.r], [vrs1.s, vrs2.s], message).should.be.rejectedWith(ERROR_MSG);
      (await validatorContract.validators()).should.be.deep.equal([authorities[0], authorities[1]])
    })
  })

  describe('#onTokenTransfer', async () => {
    it('can only be called from token contract', async ()=> {
      const owner = accounts[3]
      const user = accounts[4]
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18, {from: owner});
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted);
      await token.mint(user, halfEther, {from: owner }).should.be.fulfilled;
      await token.transferOwnership(foreignBridge.address, {from: owner});
      await foreignBridge.onTokenTransfer(user, halfEther, '0x00', {from: owner}).should.be.rejectedWith(ERROR_MSG);
      await token.transferAndCall(foreignBridge.address, halfEther, '0x00', {from: user}).should.be.fulfilled;
      '0'.should.be.bignumber.equal(await token.totalSupply());
      '0'.should.be.bignumber.equal(await token.balanceOf(user));
    })
    it('should not allow to burn more than the limit', async () => {
      const owner = accounts[3]
      const user = accounts[4]
      const valueMoreThanLimit = halfEther.add(1);
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18, {from: owner});
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted);
      await token.mint(user, valueMoreThanLimit, {from: owner }).should.be.fulfilled;
      await token.transferOwnership(foreignBridge.address, {from: owner});
      await token.transferAndCall(foreignBridge.address, valueMoreThanLimit, '0x00', {from: user}).should.be.rejectedWith(ERROR_MSG);
      valueMoreThanLimit.should.be.bignumber.equal(await token.totalSupply());
      valueMoreThanLimit.should.be.bignumber.equal(await token.balanceOf(user));
      const {logs} = await token.transferAndCall(foreignBridge.address, halfEther, '0x00', {from: user}).should.be.fulfilled;
      '1'.should.be.bignumber.equal(await token.totalSupply());
      '1'.should.be.bignumber.equal(await token.balanceOf(user));
      const events = await getEvents(foreignBridge, {event: 'UserRequestForAffirmation'});
      events[0].args.should.be.deep.equal({
        recipient: user,
        value: halfEther
      })
    })
    it('should only let to send within maxPerTx limit', async () => {
      const owner = accounts[3]
      const user = accounts[4]
      const valueMoreThanLimit = halfEther.add(1);
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18, {from: owner});
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted);
      await token.mint(user, oneEther.add(1), {from: owner }).should.be.fulfilled;
      await token.transferOwnership(foreignBridge.address, {from: owner});
      await token.transferAndCall(foreignBridge.address, valueMoreThanLimit, '0x00', {from: user}).should.be.rejectedWith(ERROR_MSG);
      oneEther.add(1).should.be.bignumber.equal(await token.totalSupply());
      oneEther.add(1).should.be.bignumber.equal(await token.balanceOf(user));
      await token.transferAndCall(foreignBridge.address, halfEther, '0x00', {from: user}).should.be.fulfilled;
      valueMoreThanLimit.should.be.bignumber.equal(await token.totalSupply());
      valueMoreThanLimit.should.be.bignumber.equal(await token.balanceOf(user));
      await token.transferAndCall(foreignBridge.address, halfEther, '0x00', {from: user}).should.be.fulfilled;
      '1'.should.be.bignumber.equal(await token.totalSupply());
      '1'.should.be.bignumber.equal(await token.balanceOf(user));
      await token.transferAndCall(foreignBridge.address, '1', '0x00', {from: user}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not let to withdraw less than minPerTx', async () => {
      const owner = accounts[3]
      const user = accounts[4]
      const valueLessThanMinPerTx = minPerTx.sub(1);
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18, {from: owner});
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted);
      await token.mint(user, oneEther, {from: owner }).should.be.fulfilled;
      await token.transferOwnership(foreignBridge.address, {from: owner});
      await token.transferAndCall(foreignBridge.address, valueLessThanMinPerTx, '0x00', {from: user}).should.be.rejectedWith(ERROR_MSG);
      oneEther.should.be.bignumber.equal(await token.totalSupply());
      oneEther.should.be.bignumber.equal(await token.balanceOf(user));
      await token.transferAndCall(foreignBridge.address, minPerTx, '0x00', {from: user}).should.be.fulfilled;
      oneEther.sub(minPerTx).should.be.bignumber.equal(await token.totalSupply());
      oneEther.sub(minPerTx).should.be.bignumber.equal(await token.balanceOf(user));
    })
  })

  describe('#setting limits', async () => {
    let foreignBridge;
    beforeEach(async () => {
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted);
      await token.transferOwnership(foreignBridge.address)
    })
    it('#setMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await foreignBridge.setMaxPerTx(halfEther, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.setMaxPerTx(halfEther, {from: owner}).should.be.fulfilled;

      await foreignBridge.setMaxPerTx(oneEther, {from: owner}).should.be.rejectedWith(ERROR_MSG);
    })

    it('#setMinPerTx allows to set only to owner and cannot be more than daily limit and should be less than maxPerTx', async () => {
      await foreignBridge.setMinPerTx(minPerTx, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.setMinPerTx(minPerTx, {from: owner}).should.be.fulfilled;

      await foreignBridge.setMinPerTx(oneEther, {from: owner}).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe('#upgradeable', async () => {
    it('can be upgraded', async () => {
      const REQUIRED_NUMBER_OF_VALIDATORS = 1
      const VALIDATORS = [accounts[1]]
      const PROXY_OWNER  = accounts[0]
      const FOREIGN_DAILY_LIMIT = oneEther;
      const FOREIGN_MAX_AMOUNT_PER_TX = halfEther;
      const FOREIGN_MIN_AMOUNT_PER_TX = minPerTx;
      // Validators Contract
      let validatorsProxy = await EternalStorageProxy.new().should.be.fulfilled;
      const validatorsContractImpl = await ForeignBridgeValidators.new().should.be.fulfilled;
      await validatorsProxy.upgradeTo('1', validatorsContractImpl.address).should.be.fulfilled;
      validatorsContractImpl.address.should.be.equal(await validatorsProxy.implementation())

      validatorsProxy = await ForeignBridgeValidators.at(validatorsProxy.address);
      await validatorsProxy.initialize(VALIDATORS, PROXY_OWNER).should.be.fulfilled;
      // POA20
      let token = await POA20.new("POA ERC20 Foundation", "POA20", 18);

      // ForeignBridge V1 Contract

      let foreignBridgeProxy = await EternalStorageProxy.new().should.be.fulfilled;
      const foreignBridgeImpl = await ForeignBridge.new().should.be.fulfilled;
      await foreignBridgeProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled;

      foreignBridgeProxy = await ForeignBridge.at(foreignBridgeProxy.address);
      await foreignBridgeProxy.initialize(validatorsProxy.address, token.address, FOREIGN_DAILY_LIMIT, FOREIGN_MAX_AMOUNT_PER_TX, FOREIGN_MIN_AMOUNT_PER_TX, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted)
      await token.transferOwnership(foreignBridgeProxy.address).should.be.fulfilled;

      foreignBridgeProxy.address.should.be.equal(await token.owner());

      // Deploy V2
      let foreignImplV2 = await ForeignBridgeV2.new();
      let foreignBridgeProxyUpgrade = await EternalStorageProxy.at(foreignBridgeProxy.address);
      await foreignBridgeProxyUpgrade.upgradeTo('2', foreignImplV2.address).should.be.fulfilled;
      foreignImplV2.address.should.be.equal(await foreignBridgeProxyUpgrade.implementation())
    })
    it('can be deployed via upgradeToAndCall', async () => {
      const tokenAddress = token.address
      const validatorsAddress = validatorContract.address
      const FOREIGN_DAILY_LIMIT = oneEther;
      const FOREIGN_MAX_AMOUNT_PER_TX = halfEther;
      const FOREIGN_MIN_AMOUNT_PER_TX = minPerTx;

      let storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      let foreignBridge =  await ForeignBridge.new();
      let data = foreignBridge.initialize.request(
        validatorsAddress, tokenAddress, FOREIGN_DAILY_LIMIT, FOREIGN_MAX_AMOUNT_PER_TX, FOREIGN_MIN_AMOUNT_PER_TX, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted).params[0].data
      await storageProxy.upgradeToAndCall('1', foreignBridge.address, data).should.be.fulfilled;
      let finalContract = await ForeignBridge.at(storageProxy.address);
      true.should.be.equal(await finalContract.isInitialized());
      validatorsAddress.should.be.equal(await finalContract.validatorContract())
      FOREIGN_DAILY_LIMIT.should.be.bignumber.equal(await finalContract.dailyLimit())
      FOREIGN_MAX_AMOUNT_PER_TX.should.be.bignumber.equal(await finalContract.maxPerTx())
      FOREIGN_MIN_AMOUNT_PER_TX.should.be.bignumber.equal(await finalContract.minPerTx())
    })
    it('can transfer ownership', async () => {
      const token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      const foreignBridge =  await ForeignBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      const data = foreignBridge.initialize.request(
        validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted).params[0].data
      await storageProxy.upgradeToAndCall('1', foreignBridge.address, data).should.be.fulfilled;
      await storageProxy.transferProxyOwnership(owner).should.be.fulfilled
    })
  })

  describe('#claimTokens', async () => {
    it('can send erc20', async () => {
      const owner = accounts[0];
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      const foreignBridgeImpl = await ForeignBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled
      const foreignBridge = await ForeignBridge.at(storageProxy.address);
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted);
      await token.transferOwnership(foreignBridge.address)

      let tokenSecond = await POA20.new("Roman Token", "RST", 18);

      await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled;
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      await tokenSecond.transfer(foreignBridge.address, halfEther);
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(foreignBridge.address))

      await foreignBridge.claimTokens(tokenSecond.address, accounts[3], {from: owner});
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(foreignBridge.address))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[3]))

    })
    it('also calls claimTokens on tokenAddress', async () => {
      const owner = accounts[0];
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      const foreignBridgeImpl = await ForeignBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled
      const foreignBridge = await ForeignBridge.at(storageProxy.address);
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, homeDailyLimit, homeMaxPerTx, owner, erc677tokenPreMinted);
      await token.transferOwnership(foreignBridge.address)

      let tokenSecond = await POA20.new("Roman Token", "RST", 18);

      await tokenSecond.mint(accounts[0], 150).should.be.fulfilled;
      '150'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      await tokenSecond.transfer(token.address, '150');
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      '150'.should.be.bignumber.equal(await tokenSecond.balanceOf(token.address))

      await foreignBridge.claimTokensFromErc677(tokenSecond.address, accounts[3], {from: owner});
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(foreignBridge.address))
      '150'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[3]))
    })
  })
})
