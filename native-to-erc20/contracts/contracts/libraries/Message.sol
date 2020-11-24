pragma solidity 0.4.24;

import "../interfaces/IBridgeValidators.sol";
import "../interfaces/IForeignBridgeValidators.sol";

library Message {
    function addressArrayContains(address[] array, address value) internal pure returns (bool) {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == value) {
                return true;
            }
        }
        return false;
    }
    // layout of message :: bytes:
    // offset  0: 32 bytes :: uint256 - message length
    // offset 32: 20 bytes :: address - recipient address
    // offset 52: 32 bytes :: uint256 - value
    // offset 84: 32 bytes :: bytes32 - transaction hash
    // offset 104: 20 bytes :: address - contract address to prevent double spending

    // bytes 1 to 32 are 0 because message length is stored as little endian.
    // mload always reads 32 bytes.
    // so we can and have to start reading recipient at offset 20 instead of 32.
    // if we were to read at 32 the address would contain part of value and be corrupted.
    // when reading from offset 20 mload will read 12 zero bytes followed
    // by the 20 recipient address bytes and correctly convert it into an address.
    // this saves some storage/gas over the alternative solution
    // which is padding address to 32 bytes and reading recipient at offset 32.
    // for more details see discussion in:
    // https://github.com/paritytech/parity-bridge/interfaces/Issues/61
    function parseMessage(bytes message)
        internal
        pure
        returns(address recipient, uint256 amount, bytes32 txHash, address contractAddress)
    {
        require(isMessageValid(message));
        assembly {
            recipient := and(mload(add(message, 20)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            amount := mload(add(message, 52))
            txHash := mload(add(message, 84))
            contractAddress := mload(add(message, 104))
        }
    }

    function isMessageValid(bytes _msg) internal pure returns(bool) {
        return _msg.length == requiredMessageLength();
    }

    function requiredMessageLength() internal pure returns(uint256) {
        return 104;
    }

    function recoverAddressFromSignedMessage(bytes signature, bytes message, bool knownLength) internal pure returns (address) {
        require(signature.length == 65);
        bytes32 r;
        bytes32 s;
        bytes1 v;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := mload(add(signature, 0x60))
        }
        if (knownLength) {
            return ecrecover(hashMessage(message), uint8(v), r, s);
        } else {
            return ecrecover(hashMessageOfUnknownLength(message), uint8(v), r, s);
        }
    }

    function hashMessage(bytes message) internal pure returns (bytes32) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n";
        // message is always 84 length
        string memory msgLength = "104";
        return keccak256(abi.encodePacked(prefix, msgLength, message));
    }

    function hashMessageOfUnknownLength(bytes message) internal pure returns (bytes32) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n";
        uint256 lengthOffset;
        uint256 length;
        assembly {
          // The first word of a string is its length
          length := mload(message)
          // The beginning of the base-10 message length in the prefix
          lengthOffset := add(prefix, 57)
        }
        uint256 lengthLength = 0;
        // The divisor to get the next left-most message length digit
        uint256 divisor = 100000;
        // Move one digit of the message length to the right at a time
        while (divisor != 0) {
          // The place value at the divisor
          uint256 digit = length / divisor;
          if (digit == 0) {
            // Skip leading zeros
            if (lengthLength == 0) {
              divisor /= 10;
              continue;
            }
          }
          // Found a non-zero digit or non-leading zero digit
          lengthLength++;
          // Remove this digit from the message length's current value
          length -= digit * divisor;
          // Shift our base-10 divisor over
          divisor /= 10;
          // Convert the digit to its ASCII representation (man ascii)
          digit += 0x30;
          // Move to the next character and write the digit
          lengthOffset++;
          assembly {
            mstore8(lengthOffset, digit)
          }
        }
        // The null string requires exactly 1 zero (unskip 1 leading 0)
        if (lengthLength == 0) {
          lengthLength = 1 + 0x19 + 1;
        } else {
          lengthLength += 1 + 0x19;
        }
        // Truncate the tailing zeros from the prefix
        assembly {
          mstore(prefix, lengthLength)
        }
        return keccak256(prefix, message);
    }

    function hasEnoughValidSignaturesForeignBridgeValidator(
        bytes _message,
        uint8[] _vs,
        bytes32[] _rs,
        bytes32[] _ss,
        IForeignBridgeValidators _validatorContract) internal view
    {
        uint256 requiredSignatures = _validatorContract.requiredSignatures();
        require(_vs.length == _rs.length);
        require(_vs.length == _ss.length);
        require(_vs.length >= requiredSignatures);
        bytes32 hash = hashMessage(_message);
        address[] memory encounteredAddresses = new address[](requiredSignatures);
        uint256 signaturesCount;

        for (uint256 i = 0; i < _vs.length; i++) {
            address recoveredAddress = ecrecover(hash, _vs[i], _rs[i], _ss[i]);
            if(_validatorContract.isValidator(recoveredAddress)) {
                if (!addressArrayContains(encounteredAddresses, recoveredAddress)) {
                    encounteredAddresses[i] = recoveredAddress;
                    signaturesCount++;

                    if (signaturesCount == requiredSignatures) {
                        return;
                    }
                }
            }
        }
        require(signaturesCount >=requiredSignatures);
    }

    function recover(bytes32 hash, bytes sig) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        // Check the signature length
        if (sig.length != 65) {
          return (address(0));
        }

        // Divide the signature in r, s and v variables
        assembly {
          r := mload(add(sig, 32))
          s := mload(add(sig, 64))
          v := byte(0, mload(add(sig, 96)))
        }

        // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
        if (v < 27) {
          v += 27;
        }

        // If the version is correct return the signer address
        if (v != 27 && v != 28) {
          return (address(0));
        } else {
          return ecrecover(hash, v, r, s);
        }
    }
}
