pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../BasicBridge.sol";
import "../../ERC677Receiver.sol";
import "../BasicForeignBridge.sol";
import "../ERC677Bridge.sol";

contract ForeignBridgeNativeToErc is ERC677Receiver, BasicBridge, BasicForeignBridge, ERC677Bridge {

    /// Event created on money withdraw.
    event UserRequestForAffirmation(address recipient, uint256 value);

    function initialize(
        address _validatorContract,
        address _erc677token,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256 _homeDailyLimit,
        uint256 _homeMaxPerTx,
        address _owner,
        bool _erc677tokenPreMinted
    ) public returns(bool) {
        require(!isInitialized());
        require(_validatorContract != address(0) && isContract(_validatorContract));
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _dailyLimit > _maxPerTx);
        require(_foreignGasPrice > 0);
        require(_homeMaxPerTx < _homeDailyLimit);
        require(_owner != address(0));
        addressStorage[keccak256(abi.encodePacked("validatorContract"))] = _validatorContract;
        setErc677token(_erc677token);
        uintStorage[keccak256(abi.encodePacked("dailyLimit"))] = _dailyLimit;
        uintStorage[keccak256(abi.encodePacked("deployedAtBlock"))] = block.number;
        uintStorage[keccak256(abi.encodePacked("maxPerTx"))] = _maxPerTx;
        uintStorage[keccak256(abi.encodePacked("minPerTx"))] = _minPerTx;
        uintStorage[keccak256(abi.encodePacked("gasPrice"))] = _foreignGasPrice;
        uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))] = _requiredBlockConfirmations;
        uintStorage[keccak256(abi.encodePacked("executionDailyLimit"))] = _homeDailyLimit;
        uintStorage[keccak256(abi.encodePacked("executionMaxPerTx"))] = _homeMaxPerTx;
        boolStorage[keccak256(abi.encodePacked("erc677tokenPreMinted"))] = _erc677tokenPreMinted;
        setOwner(_owner);
        setInitialize(true);
        return isInitialized();
    }

    function getBridgeMode() public pure returns(bytes4 _data) {
        return bytes4(keccak256(abi.encodePacked("native-to-erc-core")));
    }

    function claimTokensFromErc677(address _token, address _to) external onlyIfOwnerOfProxy {
        erc677token().claimTokens(_token, _to);
    }

    function setValidatorContract(address _validatorContract) external onlyIfOwnerOfProxy {
        addressStorage[keccak256(abi.encodePacked("validatorContract"))] = _validatorContract;
    }

    function executeSignatures(uint8[] vs, bytes32[] rs, bytes32[] ss, bytes message) external {
        require(Message.isMessageValid(message));
        Message.hasEnoughValidSignaturesForeignBridgeValidator(message, vs, rs, ss, validatorContract());
        address recipient;
        uint256 amount;
        bytes32 txHash;
        address contractAddress;
        (recipient, amount, txHash, contractAddress) = Message.parseMessage(message);
        if (messageWithinLimits(amount)) {
            require(contractAddress == address(this));
            require(!relayedMessages(txHash));
            setRelayedMessages(txHash, true);
            require(onExecuteMessage(recipient, amount));
            emit RelayedMessage(recipient, amount, txHash);
        } else {
            onFailedMessage(recipient, amount, txHash);
        }
    }

    function onExecuteMessage(address _recipient, uint256 _amount) internal returns(bool){
        if (_recipient == address(this)) {
            return erc677token().mint(_recipient, _amount);
        }
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_amount));
        if (boolStorage[keccak256(abi.encodePacked("erc677tokenPreMinted"))]) {
            return erc677token().transfer(_recipient, _amount);
        }
        return erc677token().mint(_recipient, _amount);
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value, bytes /*_data*/) internal {
        emit UserRequestForAffirmation(_from, _value);
    }

    function messageWithinLimits(uint256 _amount) internal view returns(bool) {
        return withinExecutionLimit(_amount);
    }

    function onFailedMessage(address, uint256, bytes32) internal {
        revert();
    }

    function addMinter(address _minter) external onlyIfOwnerOfProxy {
        erc677token().addMinter(_minter);
    }
}
