pragma solidity 0.4.24;

import "../../contracts/interfaces/ITransferManager.sol";

contract TransferManagerTest is ITransferManager {
  function verifyTransfer(address _from, address _to, uint256 _amount) public view returns(bool) {
    if (_amount > 1e21) {
      return false;
    }
    return true;
  }
}