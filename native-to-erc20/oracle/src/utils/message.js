const assert = require('assert')
const Web3Utils = require('web3-utils')

// strips leading "0x" if present
function strip0x (input) {
  return input.replace(/^0x/, '')
}

function createMessage ({
  recipient,
  value,
  transactionHash,
  bridgeAddress,
  expectedMessageLength
}) {
  recipient = strip0x(recipient)
  assert.strictEqual(recipient.length, 20 * 2)

  value = Web3Utils.numberToHex(value)
  value = Web3Utils.padLeft(value, 32 * 2)

  value = strip0x(value)
  assert.strictEqual(value.length, 64)

  transactionHash = strip0x(transactionHash)
  assert.strictEqual(transactionHash.length, 32 * 2)

  bridgeAddress = strip0x(bridgeAddress)
  assert.strictEqual(bridgeAddress.length, 20 * 2)

  const message = `0x${recipient}${value}${transactionHash}${bridgeAddress}`
  assert.strictEqual(message.length, 2 + 2 * expectedMessageLength)
  return message
}

function createNewSetMessage ({
  newSet,
  transactionHash,
  bridgeAddress
}) {
  for (let i = 0; i < newSet.length; i++) {
    newSet[i] = strip0x(newSet[i])
    assert.strictEqual(newSet[i].length, 20 * 2)
  }

  transactionHash = strip0x(transactionHash)
  assert.strictEqual(transactionHash.length, 32 * 2)

  bridgeAddress = strip0x(bridgeAddress)
  assert.strictEqual(bridgeAddress.length, 20 * 2)

  const message = `0x${transactionHash}${bridgeAddress}${newSet.join('')}`
  return message
}

function parseMessage (message) {
  message = strip0x(message)

  const recipientStart = 0
  const recipientLength = 40
  const recipient = `0x${message.slice(recipientStart, recipientStart + recipientLength)}`

  const amountStart = recipientStart + recipientLength
  const amountLength = 32 * 2
  const amount = `0x${message.slice(amountStart, amountStart + amountLength)}`

  const txHashStart = amountStart + amountLength
  const txHashLength = 32 * 2
  const txHash = `0x${message.slice(txHashStart, txHashStart + txHashLength)}`

  const contractAddressStart = txHashStart + txHashLength
  const contractAddressLength = 32 * 2
  const contractAddress = `0x${message.slice(
    contractAddressStart,
    contractAddressStart + contractAddressLength
  )}`

  return {
    recipient,
    amount,
    txHash,
    contractAddress
  }
}

function parseNewSetMessage (message) {
  message = strip0x(message)

  const txHashStart = 0
  const txHashLength = 32 * 2
  const txHash = `0x${message.slice(txHashStart, txHashStart + txHashLength)}`

  const contractAddressStart = txHashStart + txHashLength
  const contractAddressLength = 40
  const contractAddress = `0x${message.slice(
    contractAddressStart,
    contractAddressStart + contractAddressLength
  )}`

  let newSetItemStart = contractAddressStart + contractAddressLength
  const newSetItemLength = 40
  const newSet = []
  while (newSetItemStart + newSetItemLength <= message.length) {
    newSet.push(`0x${message.slice(newSetItemStart, newSetItemStart + newSetItemLength)}`)
    newSetItemStart += newSetItemLength
  }

  return {
    newSet,
    txHash,
    contractAddress
  }
}

function signatureToVRS (signature) {
  assert.strictEqual(signature.length, 2 + 32 * 2 + 32 * 2 + 2)
  signature = strip0x(signature)
  const v = parseInt(signature.substr(64 * 2), 16)
  const r = `0x${signature.substr(0, 32 * 2)}`
  const s = `0x${signature.substr(32 * 2, 32 * 2)}`
  return { v, r, s }
}

module.exports = {
  createMessage,
  createNewSetMessage,
  parseMessage,
  parseNewSetMessage,
  signatureToVRS
}
