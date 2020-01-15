pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../libraries/Message.sol";

contract BasicForeignBridge is EternalStorage {
    using SafeMath for uint256;

    /// triggered when relay of deposit from HomeBridge is complete
    event RelayedMessage(address recipient, uint value, bytes32 transactionHash);

    function onExecuteMessage(address, uint256) internal returns(bool);

    function setRelayedMessages(bytes32 _txHash, bool _status) internal {
        boolStorage[keccak256(abi.encodePacked("relayedMessages", _txHash))] = _status;
    }

    function relayedMessages(bytes32 _txHash) public view returns(bool) {
        return boolStorage[keccak256(abi.encodePacked("relayedMessages", _txHash))];
    }

    function setLastRelayedBlockNumber(uint256 _blockNumber) internal {
        uintStorage[keccak256(abi.encodePacked("relayedMessagesLastBlockNumber"))] = _blockNumber;
    }

    function lastRelayedBlockNumber() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("relayedMessagesLastBlockNumber"))];
    }

    function messageWithinLimits(uint256) internal view returns(bool);

    function onFailedMessage(address, uint256, bytes32) internal;
}
