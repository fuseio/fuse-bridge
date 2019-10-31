require('dotenv').config()
const fetch = require('node-fetch')
const Web3Utils = require('web3-utils')
const logger = require('../services/logger').child({
  module: 'gasPrice'
})
const { setIntervalAndRun } = require('../utils/utils')
const { DEFAULT_UPDATE_INTERVAL } = require('../utils/constants')

const {
  FOREIGN_GAS_PRICE_FALLBACK,
  FOREIGN_GAS_PRICE_ORACLE_URL,
  FOREIGN_GAS_PRICE_SPEED_TYPE,
  FOREIGN_GAS_PRICE_UPDATE_INTERVAL,
  HOME_GAS_PRICE_FALLBACK,
  HOME_GAS_PRICE_ORACLE_URL,
  HOME_GAS_PRICE_SPEED_TYPE,
  HOME_GAS_PRICE_UPDATE_INTERVAL
} = process.env

let cachedGasPrice = null

async function fetchGasPriceFromOracle (oracleUrl, speedType) {
  const response = await fetch(oracleUrl)
  const json = await response.json()
  const gasPrice = json[speedType]
  if (!gasPrice) {
    throw new Error(`Response from Oracle didn't include gas price for ${speedType} type.`)
  }
  return Web3Utils.toWei(gasPrice.toString(), 'gwei')
}

async function fetchGasPrice ({ oracleFn }) {
  let gasPrice = null
  try {
    gasPrice = await oracleFn()
    logger.debug({ gasPrice }, 'Gas price updated using the oracle')
  } catch (e) {
    logger.error(`Gas Price API is not available. ${e.message}`)
  }
  return gasPrice
}

let fetchGasPriceInterval = null

async function start (chainId) {
  clearInterval(fetchGasPriceInterval)

  let oracleUrl = null
  let speedType = null
  let updateInterval = null
  if (chainId === 'home') {
    oracleUrl = HOME_GAS_PRICE_ORACLE_URL
    speedType = HOME_GAS_PRICE_SPEED_TYPE
    updateInterval = HOME_GAS_PRICE_UPDATE_INTERVAL || DEFAULT_UPDATE_INTERVAL
    cachedGasPrice = HOME_GAS_PRICE_FALLBACK
  } else if (chainId === 'foreign') {
    oracleUrl = FOREIGN_GAS_PRICE_ORACLE_URL
    speedType = FOREIGN_GAS_PRICE_SPEED_TYPE
    updateInterval = FOREIGN_GAS_PRICE_UPDATE_INTERVAL || DEFAULT_UPDATE_INTERVAL
    cachedGasPrice = FOREIGN_GAS_PRICE_FALLBACK
  } else {
    throw new Error(`Unrecognized chainId '${chainId}'`)
  }

  fetchGasPriceInterval = setIntervalAndRun(async () => {
    const gasPrice = await fetchGasPrice({
      oracleFn: () => fetchGasPriceFromOracle(oracleUrl, speedType)
    })
    cachedGasPrice = gasPrice || cachedGasPrice
  }, updateInterval)
}

function getPrice () {
  return cachedGasPrice
}

module.exports = {
  start,
  fetchGasPrice,
  getPrice
}
