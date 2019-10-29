pragma solidity 0.4.24;

interface IOwnedUpgradeabilityProxy {
    function proxyOwner() external view returns (address);
}
