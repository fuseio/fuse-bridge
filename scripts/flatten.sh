#!/usr/bin/env bash

if [ -d flats ]; then
  rm -rf flats
fi

mkdir flats

./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/erc20_to_erc20/HomeBridgeErcToErc.sol > flats/HomeBridgeErcToErc_flat.sol
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/erc20_to_erc20/ForeignBridgeErcToErc.sol > flats/ForeignBridgeErcToErc_flat.sol

./node_modules/.bin/truffle-flattener contracts/upgradeability/EternalStorageProxy.sol > flats/EternalStorageProxy_flat.sol
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/BridgeValidators.sol > flats/BridgeValidators_flat.sol
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/BridgeMapper.sol > flats/BridgeMapper_flat.sol

./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/factories/ForeignBridgeFactory.sol > flats/ForeignBridgeFactory_flat.sol
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/factories/HomeBridgeFactory.sol > flats/HomeBridgeFactory_flat.sol
