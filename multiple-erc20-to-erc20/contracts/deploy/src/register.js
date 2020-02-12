const { web3Foreign, deploymentPrivateKey, FOREIGN_RPC_URL } = require('./web3')
const ForeignBridgeFactory = require('../../abis/ForeignBridgeFactory.abi.json')
const ForeignBridge = require('../../abis/ForeignBridgeErcToErc.abi.json')
const { sendRawTxForeign, privateKeyToAddress } = require('./deploymentUtils')
const { GraphQLClient } = require('graphql-request')
const lodash = require('lodash')

const {
  FOREIGN_FACTORY_ADDRESS,
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  DRY_RUN,
  CHUNK_SIZE,
  ETHEREUM_NETWORK
} = process.env

const HOME_GRAPH_URL = 'https://graph.fuse.io/subgraphs/name/fuseio/fuse'
const FOREIGN_GRAPH_URL = `https://graph.fuse.io/subgraphs/name/fuseio/fuse-${ETHEREUM_NETWORK}`
const graphClientHome = new GraphQLClient(HOME_GRAPH_URL)
const graphClientForeign = new GraphQLClient(FOREIGN_GRAPH_URL)

const factoryContract = new web3Foreign.eth.Contract(ForeignBridgeFactory, FOREIGN_FACTORY_ADDRESS)

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function registerBridge({ foreignBridge, foreignToken, foreignStartBlock }, foreignNonce) {
  console.log(`Registering foreignBridge: ${foreignBridge}, foreignToken: ${foreignToken}, foreignStartBlock: ${foreignStartBlock}`)
  try {
    const bridgeContract = new web3Foreign.eth.Contract(ForeignBridge, foreignBridge)

    const validatorContract = await bridgeContract.methods.validatorContract().call();
    console.log(`validatorContract: ${validatorContract}`)
    const data = await factoryContract.methods.registerForeignBridge(foreignBridge, validatorContract, foreignToken, foreignStartBlock).encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })

    const result = await sendRawTxForeign({
      data,
      nonce: foreignNonce,
      to: FOREIGN_FACTORY_ADDRESS,
      privateKey: deploymentPrivateKey,
      url: FOREIGN_RPC_URL
    })
    if (result.error) {
      console.error(`Failed to register the foreignBridge: ${foreignBridge}, foreignToken: ${foreignToken}, foreignStartBlock: ${foreignStartBlock}`)
      console.error(result.error)
    } else {
      console.log('bridge registered')
    }
  } catch (e) {
    console.error(`Failed to register the foreignBridge: ${foreignBridge}, foreignToken: ${foreignToken}, foreignStartBlock: ${foreignStartBlock}`)
    console.error(e)
  }

}

async function getBridges () {
  const query = `{bridgeMappings(first: 1000, where: {originNetwork: "${ETHEREUM_NETWORK}"}) {id, blockNumber, txHash, key, homeBridge, homeToken, homeStartBlock, foreignBridge, foreignToken, foreignStartBlock}}`
  const { bridgeMappings } = await graphClientHome.request(query)
  console.log(`found ${bridgeMappings.length} mappings on fuse`)

  const foreignQuery = '{foreignBridgeErcToErcs(first: 1000) { address, tokenAddress}}'
  const { foreignBridgeErcToErcs }  = await graphClientForeign.request(foreignQuery)
  console.log(`found ${foreignBridgeErcToErcs.length} bridges on foreign`)

  const bridgesDict = lodash.keyBy(foreignBridgeErcToErcs, 'address')

  return bridgeMappings.filter(mapping => !bridgesDict[mapping.foreignBridge])
}

async function registerAll() {
  const bridgeMappingsToRegister = await getBridges()
  console.log(`left ${bridgeMappingsToRegister.length} to update`)
  if (DRY_RUN === 'true') {
    return
  }

  let foreignNonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  for (let i = 0; i < Math.min(CHUNK_SIZE, bridgeMappingsToRegister.length); i++) {
    const mapping = bridgeMappingsToRegister[i]
    registerBridge(mapping, foreignNonce)
    foreignNonce++
  }
}

registerAll()