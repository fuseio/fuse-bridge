const { web3Foreign } = require('./web3')
const ForeignBridgeFactory = require('../../abis/ForeignBridgeFactory.abi.json')
const ForeignBridge = require('../../abis/ForeignBridgeErcToErc.abi.json')
const { GraphQLClient } = require('graphql-request')
const lodash = require('lodash')
// const { HOME_GRAPH_URL, FOREIGN_GRAPH_URL } = process.env

const HOME_GRAPH_URL = 'https://graph.fuse.io/subgraphs/name/fuseio/fuse'
const FOREIGN_GRAPH_URL = 'https://graph.fuse.io/subgraphs/name/fuseio/fuse-ropsten'
const graphClientHome = new GraphQLClient(HOME_GRAPH_URL)
const graphClientForeign = new GraphQLClient(FOREIGN_GRAPH_URL)

const foreignBridgeFactoryAddress = '0xABBf5D8599B2Eb7b4e1D25a1Fd737FF1987655aD'
const factoryContract = new web3Foreign.eth.Contract(ForeignBridgeFactory, foreignBridgeFactoryAddress)

async function registerBridge({ foreignBridge, foreignToken, foreignStartBlock }) {
  console.log(`Registering foreignBridge: ${foreignBridge}, foreignToken: ${foreignToken}, foreignStartBlock: ${foreignStartBlock}`)
  try {
    const bridgeContract = new web3Foreign.eth.Contract(ForeignBridge, foreignBridge)

    const validatorContract = await bridgeContract.methods.validatorContract().call();
    console.log(`validatorContract: ${validatorContract}`)

    await factoryContract.methods.registerForeignBridge(foreignBridge, validatorContract, foreignToken, foreignStartBlock).send({
      from: process.env.FOREIGN_FACTORY_OWNER
    })
    console.log('bridge registered')
  } catch (e) {
    console.error(`Failed to register the foreignBridge: ${foreignBridge}, foreignToken: ${foreignToken}, foreignStartBlock: ${foreignStartBlock}`)
    console.error(e)
  }

}

async function getBridges () {
  const query = `{bridgeMappings(first: 1000) {id, blockNumber, txHash, key, homeBridge, homeToken, homeStartBlock, foreignBridge, foreignToken, foreignStartBlock}}`
  // logger.debug(`Query: ${query.replace('\n', '')}`)
  const { bridgeMappings } = await graphClientHome.request(query)
  const foreignQuery = '{foreignBridgeErcToErcs(first: 1000) { address, tokenAddress}}'
  const { foreignBridgeErcToErcs }  = await graphClientForeign.request(foreignQuery)
  console.log(foreignBridgeErcToErcs.length)
  const bridgesDict = lodash.keyBy(foreignBridgeErcToErcs, 'address')
  return bridgeMappings.filter(mapping => !bridgesDict[mapping.foreignBridge])
}

async function registerAll() {
  const bridgeMappingsToRegister = await getBridges()
  console.log(`left ${bridgeMappingsToRegister.length} to update`)
  await registerBridge(bridgeMappingsToRegister[0])
  for (let mapping of bridgeMappingsToRegister) {
    await registerBridge(mapping)
  }
}

registerAll()

// registerBridge({
//   bridgeAddress: '0x7D982086a8aff84872b9DF986Be47115b67Dbe80',
//   tokenAddress: '0x1CAf0Ed93dD34152000ACec9441D4D9ed0f55D7B'
// })