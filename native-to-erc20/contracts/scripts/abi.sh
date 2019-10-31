#!/usr/bin/env bash

if [ -d abis ]; then
  rm -rf abis
fi

mkdir abis

./node_modules/node-jq/bin/jq '.abi' build/contracts/HomeBridgeNativeToErc.json > abis/HomeBridgeNativeToErc.abi.json
./node_modules/node-jq/bin/jq '.abi' build/contracts/ForeignBridgeNativeToErc.json > abis/ForeignBridgeNativeToErc.abi.json

./node_modules/node-jq/bin/jq '.abi' build/contracts/BridgeValidators.json > abis/BridgeValidators.abi.json
./node_modules/node-jq/bin/jq '.abi' build/contracts/ForeignBridgeValidators.json > abis/ForeignBridgeValidators.abi.json

./node_modules/node-jq/bin/jq '.abi' build/contracts/EternalStorageProxy.json > abis/EternalStorageProxy.abi.json
