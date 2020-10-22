const fs = require('fs')
const path = require('path')
const BigNumber = require('bignumber.js')
const promiseRetry = require('promise-retry')
const Web3 = require('web3')
const EthWallet = require('ethereumjs-wallet')
const _ = require('lodash')

// strips leading "0x" if present
function strip0x (input) {
  return input.replace(/^0x/, '')
}

async function syncForEach (array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

function checkHTTPS (ALLOW_HTTP, logger) {
  return function (network) {
    return function (url) {
      if (!/^https.*/.test(url)) {
        if (ALLOW_HTTP !== 'yes') {
          throw new Error(`http is not allowed: ${url}`)
        } else {
          logger.warn(
            `You are using http (${url}) on ${network} network. In production https must be used instead.`
          )
        }
      }
    }
  }
}

async function waitForFunds (web3, address, minimumBalance, cb, logger) {
  promiseRetry(
    async retry => {
      logger.debug('Getting balance of validator account')
      const newBalance = web3.utils.toBN(await web3.eth.getBalance(address))
      if (newBalance.gte(minimumBalance)) {
        logger.debug(
          { balance: newBalance, minimumBalance },
          'Validator has minimum necessary balance'
        )
        cb(newBalance)
      } else {
        logger.debug(
          { balance: newBalance, minimumBalance },
          'Balance of validator is still less than the minimum'
        )
        retry()
      }
    },
    {
      forever: true,
      factor: 1,
      minTimeout: 60 * 1000,
      maxTimeout: 30 * 60 * 1000
    }
  )
}

function addExtraGas (gas, extraPercentage) {
  gas = BigNumber(gas)
  extraPercentage = BigNumber(1 + extraPercentage)

  const gasWithExtra = gas.multipliedBy(extraPercentage).toFixed(0)

  return BigNumber(gasWithExtra)
}

function setIntervalAndRun (f, interval) {
  const handler = setInterval(f, interval)
  f()
  return handler
}

/**
 * Run function `f` and return its result, unless `timeout` milliseconds pass before `f` ends. If that happens, run
 * `kill` instead.
 *
 * @param {Function} f The function to run. It is assumed that it's an async function.
 * @param {Number} timeout Max time in milliseconds to wait for `f` to finish.
 * @param {Function} kill Function that will be called if `f` takes more than `timeout` milliseconds.
 */
async function watchdog (f, timeout, kill) {
  const timeoutHandler = setTimeout(kill, timeout)

  const result = await f()
  clearTimeout(timeoutHandler)

  return result
}

function add0xPrefix (s) {
  if (s.indexOf('0x') === 0) {
    return s
  }

  return `0x${s}`
}

function privateKeyToAddress (privateKey) {
  return privateKey
    ? new Web3().eth.accounts.privateKeyToAccount(add0xPrefix(privateKey)).address
    : null
}

function keystoreToPrivateKey (keystoreDir, keystorePass) {
  let keystore
  fs.readdirSync(keystoreDir).forEach(file => {
    if (file.startsWith('UTC')) {
      keystore = fs.readFileSync(path.join(keystoreDir, file)).toString()
    }
  })
  const password = keystorePass.toString().trim()
  const wallet = EthWallet.fromV3(keystore, password)
  const pkey = wallet.getPrivateKeyString()
  return strip0x(pkey)
}

function replaceLogsWithEvents (receipt, contract) {
  if (_.isArray(receipt.logs)) {
    // decode logs
    var events = _.map(receipt.logs, function (log) {
      return contract._decodeEventABI.call({
        name: 'ALLEVENTS',
        jsonInterface: contract.options.jsonInterface
      }, log)
    })
    // make log names keys
    receipt.events = {}
    var count = 0
    events.forEach(function (ev) {
      if (ev.event) {
        // if > 1 of the same event, don't overwrite any existing events
        if (receipt.events[ev.event]) {
          if (Array.isArray(receipt.events[ev.event])) {
            receipt.events[ev.event].push(ev)
          } else {
            receipt.events[ev.event] = [receipt.events[ev.event], ev]
          }
        } else {
          receipt.events[ev.event] = ev
        }
      } else {
        receipt.events[count] = ev
        count++
      }
    })
    delete receipt.logs
  }
  return receipt
}

module.exports = {
  syncForEach,
  checkHTTPS,
  waitForFunds,
  addExtraGas,
  setIntervalAndRun,
  watchdog,
  privateKeyToAddress,
  keystoreToPrivateKey,
  replaceLogsWithEvents
}
