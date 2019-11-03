require('dotenv').config()
const path = require('path')
const { BN, toBN } = require('web3').utils
const { connectWatcherToQueue, connection } = require('./services/amqpClient')
const { getBlockNumber } = require('./tx/web3')
const { redis } = require('./services/redisClient')
const logger = require('./services/logger')
const rpcUrlsManager = require('./services/getRpcUrlsManager')
const { checkHTTPS, watchdog } = require('./utils/utils')
const { EXIT_CODES } = require('./utils/constants')

if (process.argv.length < 3) {
  logger.error('Please check the number of arguments, config file was not provided')
  process.exit(EXIT_CODES.GENERAL_ERROR)
}

const config = require(path.join('../config/', process.argv[2]))

const processSignatureRequests = require('./events/processSignatureRequests')(config)
const processCollectedSignatures = require('./events/processCollectedSignatures')(config)
const processTransfers = require('./events/processTransfers')(config)
const processBridgeMappingsUpdated = require('./events/processBridgeMappingsUpdated')(config)

const ZERO = toBN(0)
const ONE = toBN(1)

const web3Instance = config.web3
const graphClient = config.graphClient

const graphMaxResults = process.env.GRAPH_MAX_RESULTS || 1000

async function initialize () {
  try {
    const checkHttps = checkHTTPS(process.env.ALLOW_HTTP, logger)

    rpcUrlsManager.homeUrls.forEach(checkHttps('home'))
    rpcUrlsManager.foreignUrls.forEach(checkHttps('foreign'))

    connectWatcherToQueue({
      queueName: config.queue,
      cb: runMain
    })
  } catch (e) {
    logger.error(e)
    process.exit(EXIT_CODES.GENERAL_ERROR)
  }
}

async function runMain ({ sendToQueue }) {
  try {
    if (connection.isConnected() && redis.status === 'ready') {
      if (config.maxProcessingTime) {
        await watchdog(() => main({ sendToQueue }), config.maxProcessingTime, () => {
          logger.fatal('Max processing time reached')
          process.exit(EXIT_CODES.MAX_TIME_REACHED)
        })
      } else {
        await main({ sendToQueue })
      }
    }
  } catch (e) {
    logger.error(e)
  }

  setTimeout(() => {
    runMain({ sendToQueue })
  }, config.pollingInterval)
}

async function main ({ sendToQueue }) {
  try {
    const lastBlockRedisKey = `${config.id}:lastProcessedBlock`
    const lastProcessedBlock = await getLastProcessedBlock(lastBlockRedisKey, BN.max(config.startBlock.sub(ONE), ZERO))
    const lastBlockToProcess = await getLastBlockToProcess()
    if (lastBlockToProcess.lte(lastProcessedBlock)) {
      logger.debug('All blocks already processed')
    } else {
      logger.debug('Processing')
      const fromBlock = lastProcessedBlock.add(ONE)
      const toBlock = lastBlockToProcess
      switch (config.id) {
        case 'erc-erc-multiple-deployed-bridges': {
          const query = `{bridgeMappings(first: ${graphMaxResults}, where: {blockNumber_gte: ${fromBlock}, blockNumber_lte: ${toBlock}}) {id, blockNumber, txHash, key, homeBridge, homeToken, homeStartBlock, foreignBridge, foreignToken, foreignStartBlock}}`
          logger.debug(`Query: ${query.replace('\n', '')}`)
          const { bridgeMappings } = await graphClient.request(query)
          logger.info(`Found ${bridgeMappings.length} ${config.event} events`)
          await processBridgeMappingsUpdated(bridgeMappings)
          break
        }
        case 'erc-erc-multiple-signature-request': {
          const deployedBridges = await getDeployedBridges()
          logger.debug(`Found ${deployedBridges.length} deployed bridges`)
          const homeBridges = deployedBridges.map(d => d.homeBridge)
          const query = `{userRequestForSignatureEvents(first: ${graphMaxResults}, where:{blockNumber_gte: ${fromBlock}, blockNumber_lte: ${toBlock}, bridgeAddress_in: ${JSON.stringify(homeBridges)}}) {id, blockNumber, txHash, bridgeAddress, tokenAddress, recipient, value, data}}`
          const { userRequestForSignatureEvents } = await graphClient.request(query)
          logger.info(`Found ${userRequestForSignatureEvents.length} ${config.event} events`)
          const job = await processSignatureRequests(userRequestForSignatureEvents, deployedBridges)
          logger.info('Transactions to send:', job.length)
          if (job.length) {
            await sendToQueue(job)
          }
          break
        }
        case 'erc-erc-multiple-collected-signatures': {
          const deployedBridges = await getDeployedBridges()
          logger.debug(`Found ${deployedBridges.length} deployed bridges`)
          const homeBridges = deployedBridges.map(d => d.homeBridge)
          const query = `{collectedSignaturesEvents(first: ${graphMaxResults}, where:{blockNumber_gte: ${fromBlock}, blockNumber_lte: ${toBlock}, bridgeAddress_in: ${JSON.stringify(homeBridges)}}) {id, blockNumber, txHash, bridgeAddress, authorityResponsibleForRelay, messageHash, numberOfCollectedSignatures}}`
          const { collectedSignaturesEvents } = await graphClient.request(query)
          logger.info(`Found ${collectedSignaturesEvents.length} ${config.event} events`)
          const job = await processCollectedSignatures(collectedSignaturesEvents, deployedBridges)
          logger.info('Transactions to send:', job.length)
          if (job.length) {
            await sendToQueue(job)
          }
          break
        }
        case 'erc-erc-multiple-affirmation-request': {
          const deployedBridges = await getDeployedBridges()
          logger.debug(`Found ${deployedBridges.length} deployed bridges`)
          const foreignBridges = deployedBridges.map(d => d.foreignBridge)
          // TODO
          break
        }
        default:
          throw new Error(`Unknown config id ${config.id}`)
      }
      logger.debug({ lastProcessedBlock: lastBlockToProcess.toString() }, 'Updating last processed block')
      await updateLastProcessedBlock(lastBlockRedisKey, lastBlockToProcess)
    }
  } catch (e) {
    logger.error(e)
  }
  logger.debug('Finished')
}

async function getLastProcessedBlock (lastBlockRedisKey, lastBlockFromConfig) {
  const result = await redis.get(lastBlockRedisKey)
  logger.debug(
    { fromRedis: result, fromConfig: lastBlockFromConfig.toString() },
    'Last Processed block obtained'
  )
  return result ? toBN(result) : lastBlockFromConfig
}

async function getLastBlockToProcess () {
  const lastBlockNumber = await getBlockNumber(web3Instance).then(toBN)
  const requiredBlockConfirmations = config.requiredBlockConfirmations
  return lastBlockNumber.sub(requiredBlockConfirmations)
}

async function getDeployedBridges () {
  return redis
    .hgetall(config.deployedBridgesRedisKey)
    .then(deployedBridges => Object.keys(deployedBridges).map(k => JSON.parse(deployedBridges[k])))
}

function updateLastProcessedBlock (lastBlockRedisKey, lastBlockNumber) {
  return redis.set(lastBlockRedisKey, lastBlockNumber.toString())
}

initialize()
