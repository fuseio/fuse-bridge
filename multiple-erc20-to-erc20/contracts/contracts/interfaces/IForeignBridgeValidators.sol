pragma solidity 0.4.24;

interface IForeignBridgeValidators {
    function isValidator(address _validator) external view returns(bool);
    function requiredSignatures() external view returns(uint256);
    function setValidators(address[] _validators) external returns(bool);
}
