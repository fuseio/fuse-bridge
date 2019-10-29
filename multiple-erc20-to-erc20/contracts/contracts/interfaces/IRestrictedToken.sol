pragma solidity 0.4.24;

interface IRestrictedToken {
    event TransferManagerSet(address transferManager);

    function setTransferManager(address _transferManager) external;
    function verifyTransfer(address _from, address _to, uint256 _value) external view;
}