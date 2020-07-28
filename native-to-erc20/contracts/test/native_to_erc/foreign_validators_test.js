const ForeignBridgeValidators = artifacts.require("ForeignBridgeValidators.sol");
const ForeignBridgeValidatorsMock = artifacts.require("ForeignBridgeValidatorsMock.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");
const {ERROR_MSG, ERROR_MSG_OPCODE, ZERO_ADDRESS} = require('../setup');
const ethUtils = require('ethereumjs-util');

contract('ForeignBridgeValidators', async (accounts) => {
  let token
  let owner = accounts[0]
  let foreignBridgeValidators
  const user = accounts[1];
  beforeEach(async () => {
    foreignBridgeValidators = await ForeignBridgeValidators.new();
  })
  describe('#initialize', async () => {
    it('sets values', async () => {
      ZERO_ADDRESS.should.be.equal(await foreignBridgeValidators.owner())
      '0'.should.be.bignumber.equal(await foreignBridgeValidators.validatorCount())
      false.should.be.equal(await foreignBridgeValidators.isValidator(accounts[0]))
      false.should.be.equal(await foreignBridgeValidators.isValidator(accounts[1]))
      false.should.be.equal(await foreignBridgeValidators.isInitialized())
      '0'.should.be.bignumber.equal(await foreignBridgeValidators.requiredSignatures())
      '0'.should.be.bignumber.equal(await foreignBridgeValidators.deployedAtBlock())
      await foreignBridgeValidators.initialize([accounts[0], accounts[1]], ZERO_ADDRESS, {from: accounts[2]}).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeValidators.initialize([accounts[0], accounts[1]], accounts[2], {from: accounts[2]}).should.be.fulfilled;
      await foreignBridgeValidators.initialize([accounts[0], accounts[1]], accounts[2], {from: accounts[2]}).should.be.rejectedWith(ERROR_MSG);
      true.should.be.equal(await foreignBridgeValidators.isInitialized())
      '2'.should.be.bignumber.equal(await foreignBridgeValidators.requiredSignatures())
      true.should.be.equal(await foreignBridgeValidators.isValidator(accounts[0]))
      true.should.be.equal(await foreignBridgeValidators.isValidator(accounts[1]))
      accounts[2].should.be.equal(await foreignBridgeValidators.owner())
      '2'.should.be.bignumber.equal(await foreignBridgeValidators.validatorCount());
      (await foreignBridgeValidators.deployedAtBlock()).should.be.bignumber.above(0)
      const [major, minor, patch] = await foreignBridgeValidators.getForeignBridgeValidatorsInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })
  })

  describe('#setValidators', async () => {
    let owner = accounts[2];
    let validators = [accounts[0], accounts[1]];
    beforeEach(async () => {
      await foreignBridgeValidators.initialize(validators, owner, {from: owner}).should.be.fulfilled
      '2'.should.be.bignumber.equal(await foreignBridgeValidators.validatorCount())
      '2'.should.be.bignumber.equal(await foreignBridgeValidators.requiredSignatures())
    })
    it('sets validators', async () => {
      let newSet = [accounts[0], accounts[1], accounts[2], accounts[3]]
      false.should.be.equal(await foreignBridgeValidators.isValidator(accounts[2]))
      false.should.be.equal(await foreignBridgeValidators.isValidator(accounts[3]))
      await foreignBridgeValidators.setValidators(newSet, {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
      const {logs} = await foreignBridgeValidators.setValidators(newSet, {from: owner}).should.be.fulfilled
      true.should.be.equal(await foreignBridgeValidators.isValidator(accounts[0]))
      true.should.be.equal(await foreignBridgeValidators.isValidator(accounts[1]))
      true.should.be.equal(await foreignBridgeValidators.isValidator(accounts[2]))
      true.should.be.equal(await foreignBridgeValidators.isValidator(accounts[3]))
      '4'.should.be.bignumber.equal(await foreignBridgeValidators.validatorCount())
      '3'.should.be.bignumber.equal(await foreignBridgeValidators.requiredSignatures())
      logs[0].event.should.be.equal('ValidatorsChanged')
      logs[0].args.validators.should.be.deep.equal(newSet)
      logs[1].event.should.be.equal('RequiredSignaturesChanged')
      logs[1].args.requiredSignatures.should.be.bignumber.equal('3')
    })
  })

  describe('#upgradable', async () => {
    it('can be upgraded via upgradeToAndCall', async () => {
      let storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      let validators = [accounts[0], accounts[1]];
      let owner = accounts[2]
      let data = foreignBridgeValidators.initialize.request(validators, owner).params[0].data
      await storageProxy.upgradeToAndCall('1', foreignBridgeValidators.address, data).should.be.fulfilled;
      let finalContract = await ForeignBridgeValidators.at(storageProxy.address);
      true.should.be.equal(await finalContract.isInitialized());
      '2'.should.be.bignumber.equal(await finalContract.requiredSignatures())
      true.should.be.equal(await finalContract.isValidator(validators[0]))
      true.should.be.equal(await finalContract.isValidator(validators[1]))
      owner.should.be.equal(await finalContract.owner())
      validators.length.should.be.bignumber.equal(await finalContract.validatorCount())
    })
  })

  describe('#stress tests', () => {
    beforeEach(async () => {
      foreignBridgeValidators = await ForeignBridgeValidatorsMock.new();

      const numberOfValidators = 60
      const validators = []
      for (let i = 0; i < numberOfValidators; i++) {
        const validator = ethUtils.bufferToHex(ethUtils.generateAddress(accounts[0], i))
        validators.push(validator)
      }
      await foreignBridgeValidators.initialize(validators, accounts[2], {from: accounts[2]}).should.be.fulfilled;
    })

    it('check gas for isValidator', async () => {
      await foreignBridgeValidators.isValidatorExecute(accounts[1])
    })

    // console.log(accounts.length)
    // console.log(validators)
    // await foreignBridgeValidators.initialize([accounts[0], accounts[1]], ZERO_ADDRESS, {from: accounts[2]}).should.be.rejectedWith(ERROR_MSG)
  })
})
