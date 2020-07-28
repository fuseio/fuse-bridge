pragma solidity 0.4.24;

import "../upgradeable_contracts/native_to_erc20/ForeignBridgeNativeToErc.sol";

contract ForeignBridgeV2 is ForeignBridgeNativeToErc {
    // used for testing
    address public something;
    function doSomething(address _newTokenOwner) public onlyOwner {
        something = _newTokenOwner;
    }
}
