pragma solidity 0.4.24;

import '../upgradeable_contracts/BridgeValidators.sol';

contract BridgeValidatorsMock is BridgeValidators {
  using SafeMath for uint256;

  function setRequiredSignatures(uint256 _requiredSignatures) external {
    uintStorage[REQUIRED_SIGNATURES] = _requiredSignatures;
    emit RequiredSignaturesChanged(requiredSignatures());
  }

  function setOwnerMock(address _owner) public {
    setOwner(_owner);
  }

  function isValidatorExecute(address _address) public {
    isValidator(_address);
  }
}