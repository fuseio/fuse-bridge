const assert = require("assert");
const Web3Utils = require("web3-utils");
const env = require("../loadEnv");
const Web3 = require("web3");

const {
  deployContract,
  privateKeyToAddress,
  sendRawTxForeign,
  getContract,
} = require("../deploymentUtils");
const {
  web3Foreign,
  deploymentPrivateKey,
  FOREIGN_RPC_URL,
} = require("../web3");

const EternalStorageProxy = require("../../../build/contracts/EternalStorageProxy.json");
// const ForeignBridgeValidators = require('../../../build/contracts/ForeignBridgeValidators.json')
const ForeignBridge = require("../../../build/contracts/ForeignBridgeNativeToErc.json");

const { DEPLOYMENT_ACCOUNT_PRIVATE_KEY, FOREIGN_BRIDGE_STORAGE_ADDRESS } = env;

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY
);

async function deployForeign() {
  let foreignNonce = await web3Foreign.eth.getTransactionCount(
    DEPLOYMENT_ACCOUNT_ADDRESS
  );
  console.log("\n========================================");
  console.log("upgrading ForeignBridge");
  console.log("========================================");

  const foreignBridgeStorage = await getContract(
    EternalStorageProxy,
    FOREIGN_BRIDGE_STORAGE_ADDRESS,
    "foreign"
  );
  console.log(
    "[Foreign] ForeignBridge Storage: ",
    foreignBridgeStorage.options.address
  );

  console.log("\ndeploying implementation for foreign bridge");
  const foreignBridgeImplementation = await deployContract(ForeignBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: "foreign",
    nonce: foreignNonce,
  });
  foreignNonce++;
  console.log(
    "[Foreign] ForeignBridge Implementation: ",
    foreignBridgeImplementation.options.address
  );

  console.log(
    "\nhooking up ForeignBridge storage to ForeignBridge implementation"
  );
  const upgradeToForeignBridgeData = await foreignBridgeStorage.methods
    .upgradeTo('5',foreignBridgeImplementation.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS });
  const txUpgradeToForeignBridge = await sendRawTxForeign({
    data: upgradeToForeignBridgeData,
    nonce: foreignNonce,
    to: foreignBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL,
  });
  assert.strictEqual(
    Web3Utils.hexToNumber(txUpgradeToForeignBridge.status),
    1,
    "Transaction Failed"
  );
  foreignNonce++;

  console.log("\nForeign Upgrade Bridge completed");
  return {
    foreignBridge: {
      address: foreignBridgeStorage.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(
        foreignBridgeStorage.deployedBlockNumber
      ),
    },
  };
}

module.exports = deployForeign;
