pragma solidity 0.4.24;

import "../EternalOwnable.sol";
import "../../interfaces/IForeignBridgeValidators.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../../upgradeability/EternalStorage.sol";

contract ForeignBridgeValidators is IForeignBridgeValidators, EternalStorage, EternalOwnable {
  using SafeMath for uint256;

  event ValidatorsChanged (address[] validators);
  event RequiredSignaturesChanged (uint256 requiredSignatures);

  // foreignBridge is the owner of this contract
  function initialize(address[] _initialValidators, address _foreignBridge) public returns (bool) {
    require(!isInitialized());
    require(_foreignBridge != address(0));
    setOwner(_foreignBridge);
    for (uint256 i = 0; i < _initialValidators.length; i++) {
        require(_initialValidators[i] != address(0));
    }
    _setValidators(_initialValidators);
    emit ValidatorsChanged(_initialValidators);
    _setRequiredSignatures();
    emit RequiredSignaturesChanged(requiredSignatures());
    _setDeployedAtBlock();
    _setInitialize(true);
    return isInitialized();
  }

  function setValidators(address[] _validators) external onlyOwner returns (bool) {
    for (uint256 i = 0; i < _validators.length; i++) {
      require(_validators[i] != address(0));
    }
    _setValidators(_validators);
    emit ValidatorsChanged(_validators);
    _setRequiredSignatures();
    emit RequiredSignaturesChanged(requiredSignatures());
    return true;
  }

  bytes32 internal constant VALIDATORS = keccak256(abi.encodePacked("validators"));
  bytes32 internal constant REQUIRED_SIGNATURES = keccak256(abi.encodePacked("requiredSignatures"));
  bytes32 internal constant IS_INITIALIZED = keccak256(abi.encodePacked("isInitialized"));
  bytes32 internal constant DEPLOYED_AT_BLOCK = keccak256(abi.encodePacked("deployedAtBlock"));

  function validators() public view returns(address[]) {
    return addressArrayStorage[VALIDATORS];
  }

  function validatorCount() public view returns(uint256) {
    return addressArrayStorage[VALIDATORS].length;
  }

  function isValidator(address _address) public view returns(bool) {
    for (uint256 i; i < validatorCount(); i++) {
      if (_address == addressArrayStorage[VALIDATORS][i]) {
        return true;
      }
    }
    return false;
  }

  function requiredSignatures() public view returns(uint256) {
    return uintStorage[REQUIRED_SIGNATURES];
  }

  function isInitialized() public view returns(bool) {
      return boolStorage[IS_INITIALIZED];
  }

  function deployedAtBlock() public view returns(uint256) {
      return uintStorage[DEPLOYED_AT_BLOCK];
  }

  function getForeignBridgeValidatorsInterfacesVersion() public pure returns(uint64 major, uint64 minor, uint64 patch) {
      return (1, 0, 0);
  }

  function _setValidators(address[] _validators) private {
    addressArrayStorage[VALIDATORS] = _validators;
  }

  function _setRequiredSignatures() private {
    uintStorage[REQUIRED_SIGNATURES] = validatorCount().div(2).add(1);
    emit RequiredSignaturesChanged(requiredSignatures());
  }

  function _setInitialize(bool _status) private {
      boolStorage[IS_INITIALIZED] = _status;
  }

  function _setDeployedAtBlock() private {
    uintStorage[DEPLOYED_AT_BLOCK] = block.number;
  }
}