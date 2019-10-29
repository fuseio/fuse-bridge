pragma solidity 0.4.24;

import "./EternalOwnable.sol";
import "../upgradeability/EternalStorage.sol";
import "../libraries/Message.sol";

contract BridgeMapper is EternalStorage, EternalOwnable {

  event BridgeMappingUpdated(bytes32 key, address foreignToken, address homeToken, address foreignBridge, address homeBridge, uint256 foreignStartBlock, uint256 homeStartBlock);

  function homeBridgeByKey(bytes32 _key) public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("homeBridgeByKey", _key))];
  }

  function setHomeBridgeByKey(bytes32 _key, address _homeBridge) internal {
    addressStorage[keccak256(abi.encodePacked("homeBridgeByKey", _key))] = _homeBridge;
  }

  function foreignBridgeByKey(bytes32 _key) public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("foreignBridgeByKey", _key))];
  }

  function setForeignBridgeByKey(bytes32 _key, address _foreignBridge) internal {
    addressStorage[keccak256(abi.encodePacked("foreignBridgeByKey", _key))] = _foreignBridge;
  }

  function homeTokenByKey(bytes32 _key) public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("homeTokenByKey", _key))];
  }

  function setHomeTokenByKey(bytes32 _key, address _homeToken) internal {
    addressStorage[keccak256(abi.encodePacked("homeTokenByKey", _key))] = _homeToken;
  }

  function foreignTokenByKey(bytes32 _key) public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("foreignTokenByKey", _key))];
  }

  function setForeignTokenByKey(bytes32 _key, address _foreignToken) internal {
    addressStorage[keccak256(abi.encodePacked("foreignTokenByKey", _key))] = _foreignToken;
  }

  function homeStartBlockByKey(bytes32 _key) public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("homeStartBlockByKey", _key))];
  }

  function setHomeStartBlockByKey(bytes32 _key, uint256 _homeStartBlock) internal {
    uintStorage[keccak256(abi.encodePacked("homeStartBlockByKey", _key))] = _homeStartBlock;
  }

  function foreignStartBlockByKey(bytes32 _key) public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("foreignStartBlockByKey", _key))];
  }

  function setForeignStartBlockByKey(bytes32 _key, uint256 _foreignStartBlock) internal {
    uintStorage[keccak256(abi.encodePacked("foreignStartBlockByKey", _key))] = _foreignStartBlock;
  }

  function hashedTxs(bytes32 _hashTx) public view returns(bool) {
    return boolStorage[keccak256(abi.encodePacked("hashedTxs", _hashTx))];
  }

  function setHashedTxs(bytes32 _hashTx, bool _isExising) internal {
    boolStorage[keccak256(abi.encodePacked("hashedTxs", _hashTx))] = _isExising;
  }

  function setInitialize(bool _status) internal { 
    boolStorage[keccak256(abi.encodePacked("isInitialized"))] = _status; 
  }

  function isInitialized() public view returns(bool) { 
    return boolStorage[keccak256(abi.encodePacked("isInitialized"))]; 
  }
  

    function getAddBridgeMappingHash(bytes32 _key, address _foreignToken, address _homeToken, address _foreignBridge, address _homeBridge, uint256 _foreignStartBlock, uint256 _homeStartBlock) public pure returns (bytes32) {
    /* "23d122d7": getAddBridgeMappingHash(bytes32,address,address,address,address,uint256,uint256) */
    return keccak256(abi.encodePacked(bytes4(0x23d122d7), _key, _foreignToken, _homeToken, _foreignBridge, _homeBridge, _foreignStartBlock, _homeStartBlock));
  }

  function addBridgeMapping(bytes32 _key, address _foreignToken, address _homeToken, address _foreignBridge, address _homeBridge, uint256 _foreignStartBlock, uint256 _homeStartBlock, bytes _signature) public {
    require(_key != bytes32(0));
    require(_foreignToken != address(0));
    require(_homeToken != address(0));
    require(_foreignBridge != address(0));
    require(_homeBridge != address(0));
    require(_foreignStartBlock > 0);
    require(_homeStartBlock > 0);

    if (msg.sender != owner()) {
      bytes32 hashedParams = getAddBridgeMappingHash(_key, _foreignToken, _homeToken, _foreignBridge, _homeBridge, _foreignStartBlock, _homeStartBlock);
      address from = Message.recover(hashedParams, _signature);
      require(from == owner(), "Invalid from address recovered");

        bytes32 hashedTx = keccak256(abi.encodePacked(from, hashedParams));
        require(hashedTxs(hashedTx) == false, "Transaction hash was already used");

        setHashedTxs(hashedTx, true);
    }

    setHomeTokenByKey(_key, _homeToken);
    setForeignTokenByKey(_key, _foreignToken);
    setForeignBridgeByKey(_key, _foreignBridge);
    setHomeBridgeByKey(_key, _homeBridge);
    setForeignStartBlockByKey(_key, _foreignStartBlock);
    setHomeStartBlockByKey(_key, _homeStartBlock);
    emit BridgeMappingUpdated(_key, _foreignToken, _homeToken, _foreignBridge, _homeBridge, _foreignStartBlock, _homeStartBlock);
  }

  function removeBridgeMapping(bytes32 _key) public onlyOwner {
    setHomeTokenByKey(_key, address(0));
    setForeignTokenByKey(_key, address(0));
    setForeignBridgeByKey(_key, address(0));
    setHomeBridgeByKey(_key, address(0));
    setForeignStartBlockByKey(_key, 0);
    setHomeStartBlockByKey(_key, 0);
    emit BridgeMappingUpdated(_key, address(0), address(0), address(0), address(0), 0, 0);
  }

  function getBridgeMapperVersion() public pure returns(uint64 major, uint64 minor, uint64 patch) {
    return (3, 1, 0);
  }

  function initialize(address _owner) public returns(bool) {
    require(!isInitialized());
    setOwner(_owner);
    setInitialize(true);
    return isInitialized();
  }

}