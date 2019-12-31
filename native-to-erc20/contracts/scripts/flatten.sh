#!/usr/bin/env bash

if [ -d flats ]; then
  rm -rf flats
fi

mkdir flats

./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/native_to_erc20/HomeBridgeNativeToErc.sol > flats/HomeBridgeNativeToErc_flat.sol
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/native_to_erc20/ForeignBridgeNativeToErc.sol > flats/ForeignBridgeNativeToErc_flat.sol
./node_modules/.bin/truffle-flattener contracts/ERC677BridgeToken.sol > flats/ERC677BridgeToken_flat.sol

./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/BridgeValidators.sol > flats/BridgeValidators_flat.sol
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/native_to_erc20/ForeignBridgeValidators.sol > flats/ForeignBridgeValidators_flat.sol

./node_modules/.bin/truffle-flattener contracts/upgradeability/EternalStorageProxy.sol > flats/EternalStorageProxy_flat.sol
