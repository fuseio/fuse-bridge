require('dotenv').config()
const fetch = require('node-fetch')
const Web3Utils = require('web3-utils')
const logger = require('../services/logger').child({
  module: 'gasPrice'
})
const { setIntervalAndRun } = require('../utils/utils')
const { DEFAULT_UPDATE_INTERVAL } = require('../utils/constants')

const {
  FOREIGN_DEFAULT_GAS_PRICE,
  FOREIGN_GAS_PRICE_ORACLE_URL,
  FOREIGN_GAS_PRICE_ORACLE_SECONDARY_URL,
  FOREIGN_GAS_PRICE_SPEED_TYPE,
  FOREIGN_GAS_PRICE_FACTOR,
  FOREIGN_GAS_PRICE_UPDATE_INTERVAL,
  HOME_DEFAULT_GAS_PRICE
} = process.env

let cachedGasPrice = null

async function fetchGasPriceFromOracle (oracleUrl, speedType, factor) {
  const response = await fetch(oracleUrl)
  const json = await response.json()
  const gasPrice = factor ? Math.ceil(json[speedType] * factor) : json[speedType]
  if (!gasPrice) {
    throw new Error(`Response from Oracle didn't include gas price for ${speedType} type.`)
  }
  return Web3Utils.toWei(gasPrice.toString(), 'gwei')
}

async function fetchGasPrice ({ oracleFn, secondaryOracleFn }) {
  let gasPrice = null
  try {
    gasPrice = await oracleFn()
    logger.debug({ gasPrice }, 'Gas price updated using the oracle')
  } catch (e) {
    logger.error(`Primary Gas Price API is not available. ${e.message}`)
    logger.info('Using the secondary Gas Price API')
    gasPrice = await secondaryOracleFn()
  }
  return gasPrice
}

let fetchGasPriceInterval = null

async function start (chainId) {
  clearInterval(fetchGasPriceInterval)

  if (chainId === 'home') {
    cachedGasPrice = HOME_DEFAULT_GAS_PRICE
  } else if (chainId === 'foreign') {
    cachedGasPrice = FOREIGN_DEFAULT_GAS_PRICE
    fetchGasPriceInterval = setIntervalAndRun(async () => {
      const gasPrice = await fetchGasPrice({
        oracleFn: () => fetchGasPriceFromOracle(FOREIGN_GAS_PRICE_ORACLE_URL, FOREIGN_GAS_PRICE_SPEED_TYPE, FOREIGN_GAS_PRICE_FACTOR),
        secondaryOracleFn: () => fetchGasPriceFromOracle(FOREIGN_GAS_PRICE_ORACLE_SECONDARY_URL, FOREIGN_GAS_PRICE_SPEED_TYPE, FOREIGN_GAS_PRICE_FACTOR)
      })
      cachedGasPrice = gasPrice || cachedGasPrice
    }, FOREIGN_GAS_PRICE_UPDATE_INTERVAL || DEFAULT_UPDATE_INTERVAL)
  } else {
    throw new Error(`Unrecognized chainId '${chainId}'`)
  }
}

function getPrice () {
  return cachedGasPrice
}

module.exports = {
  start,
  fetchGasPrice,
  getPrice
}
