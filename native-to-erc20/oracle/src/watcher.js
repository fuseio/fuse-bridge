require('dotenv').config()
const path = require('path')
const { BN, toBN } = require('web3').utils
const { connectWatcherToQueue, connection } = require('./services/amqpClient')
const { getBlockNumber } = require('./tx/web3')
const { redis } = require('./services/redisClient')
const logger = require('./services/logger')
const rpcUrlsManager = require('./services/getRpcUrlsManager')
const { getRequiredBlockConfirmations, getEvents } = require('./tx/web3')
const { checkHTTPS, watchdog } = require('./utils/utils')
const { EXIT_CODES } = require('./utils/constants')

if (process.argv.length < 3) {
  logger.error('Please check the number of arguments, config file was not provided')
  process.exit(EXIT_CODES.GENERAL_ERROR)
}

const config = require(path.join('../config/', process.argv[2]))

const lastBlockRedisKeyDefault = `${config.id}:lastProcessedBlock`

const processSignatureRequests = require('./events/processSignatureRequests')(config)
const processCollectedSignatures = require('./events/processCollectedSignatures')(config)
const processAffirmationRequests = require('./events/processAffirmationRequests')(config)
const processRewardedOnCycle = require('./events/processRewardedOnCycle')(config)

const ZERO = toBN(0)
const ONE = toBN(1)

const web3Instance = config.web3

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

async function getLastProcessedBlock (lastBlockRedisKey, lastBlockFromConfig) {
  const result = await redis.get(lastBlockRedisKey)
  logger.debug(
    { fromRedis: result, fromConfig: lastBlockFromConfig.toString() },
    'Last Processed block obtained'
  )
  return result ? toBN(result) : lastBlockFromConfig
}

function updateLastProcessedBlock (lastBlockRedisKey, lastBlockNumber) {
  return redis.set(lastBlockRedisKey, lastBlockNumber.toString())
}

function processEvents (events, homeBridgeAddress, foreignBridgeAddress) {
  switch (config.id) {
    case 'native-erc-signature-request':
      return processSignatureRequests(events, homeBridgeAddress, foreignBridgeAddress)
    case 'native-erc-collected-signatures':
      return processCollectedSignatures(events, homeBridgeAddress, foreignBridgeAddress)
    case 'native-erc-affirmation-request':
      return processAffirmationRequests(events)
    case 'native-erc-rewarded-on-cycle':
      return processRewardedOnCycle(events, homeBridgeAddress, foreignBridgeAddress)
    default:
      return []
  }
}

async function getLastBlockToProcess (bridgeContract) {
  const lastBlockNumberPromise = getBlockNumber(web3Instance).then(toBN)
  const requiredBlockConfirmationsPromise = getRequiredBlockConfirmations(bridgeContract).then(toBN)
  const [lastBlockNumber, requiredBlockConfirmations] = await Promise.all([
    lastBlockNumberPromise,
    requiredBlockConfirmationsPromise
  ])

  return lastBlockNumber.sub(requiredBlockConfirmations)
}

async function processOne (
  sendToQueue,
  bridgeContractAddress,
  eventContractAddress,
  homeBridgeAddress,
  foreignBridgeAddress,
  eventFilter,
  lastProcessedBlock
) {
  logger.debug(
    `processOne --> bridgeContractAddress: ${bridgeContractAddress}, eventContractAddress: ${eventContractAddress}, homeBridgeAddress: ${homeBridgeAddress}, foreignBridgeAddress: ${foreignBridgeAddress}, eventFilter: ${JSON.stringify(eventFilter)}, lastProcessedBlock: ${lastProcessedBlock}`
  )

  const bridgeContract = new web3Instance.eth.Contract(config.bridgeAbi, bridgeContractAddress)
  const eventContract = new web3Instance.eth.Contract(config.eventAbi, eventContractAddress)

  const lastBlockToProcess = await getLastBlockToProcess(bridgeContract)

  if (lastBlockToProcess.lte(lastProcessedBlock)) {
    logger.debug('All blocks already processed')
    return lastBlockToProcess
  }

  const fromBlock = lastProcessedBlock.add(ONE)
  const toBlock = lastBlockToProcess

  const events = await getEvents({
    contract: eventContract,
    event: config.event,
    fromBlock,
    toBlock,
    filter: eventFilter
  })
  logger.info(
    `Found ${events.length} ${config.event} events for contract address
      ${eventContract.options.address}`
  )

  if (events.length) {
    const job = await processEvents(events, homeBridgeAddress, foreignBridgeAddress)
    logger.info('Transactions to send:', job.length)

    if (job.length) {
      await sendToQueue(job)
    }
  }

  return lastBlockToProcess
}

async function main ({ sendToQueue }) {
  try {
    const lastBlockRedisKey = lastBlockRedisKeyDefault
    const lastProcessedBlock = await getLastProcessedBlock(
      lastBlockRedisKey,
      BN.max(config.startBlock.sub(ONE), ZERO)
    )
    const lastBlockToProcess = await processOne(
      sendToQueue,
      config.bridgeContractAddress,
      config.eventContractAddress,
      config.homeBridgeAddress,
      config.foreignBridgeAddress,
      config.eventFilter,
      lastProcessedBlock
    )
    logger.debug(
      { lastProcessedBlock: lastBlockToProcess.toString() },
      'Updating last processed block'
    )
    await updateLastProcessedBlock(lastBlockRedisKey, lastBlockToProcess)
  } catch (e) {
    logger.error(e)
  }

  logger.debug('Finished')
}

initialize()
