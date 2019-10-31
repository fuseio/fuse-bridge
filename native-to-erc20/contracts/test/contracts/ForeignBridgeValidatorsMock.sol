pragma solidity 0.4.24;

import '../../contracts/upgradeable_contracts/native_to_erc20/ForeignBridgeValidators.sol';

contract ForeignBridgeValidatorsMock is ForeignBridgeValidators {
  using SafeMath for uint256;

  function setRequiredSignatures(uint256 _requiredSignatures) public {
    uintStorage[REQUIRED_SIGNATURES] = _requiredSignatures;
    emit RequiredSignaturesChanged(requiredSignatures());
  }

  function setOwnerMock(address _owner) public {
    setOwner(_owner);
  }
}