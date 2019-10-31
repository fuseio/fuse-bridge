pragma solidity 0.4.24;

import "../../interfaces/IForeignBridgeValidators.sol";
import "../../upgradeability/EternalStorage.sol";

contract ForeignValidatable is EternalStorage {
    function validatorContract() public view returns(IForeignBridgeValidators) {
        return IForeignBridgeValidators(addressStorage[keccak256(abi.encodePacked("validatorContract"))]);
    }

    modifier onlyValidator() {
        require(validatorContract().isValidator(msg.sender));
        _;
    }

    function requiredSignatures() public view returns(uint256) {
        return validatorContract().requiredSignatures();
    }
}
