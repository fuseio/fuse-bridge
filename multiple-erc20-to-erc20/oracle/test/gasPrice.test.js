const sinon = require('sinon')
const { expect } = require('chai')
const proxyquire = require('proxyquire').noPreserveCache()
const { fetchGasPrice } = require('../src/services/gasPrice')
const { DEFAULT_UPDATE_INTERVAL } = require('../src/utils/constants')

describe('gasPrice', () => {
  describe('fetchGasPrice', () => {
    beforeEach(() => {
      sinon.stub(console, 'error')
    })
    afterEach(() => {
      console.error.restore()
    })
    it('should fetch the gas price from the oracle', async () => {
      // given
      const oracleFnMock = () => Promise.resolve('1')

      // when
      const gasPrice = await fetchGasPrice({
        oracleFn: oracleFnMock
      })

      // then
      expect(gasPrice).to.equal('1')
    })
    it('should return null if the oracle fail', async () => {
      // given
      const oracleFnMock = () => Promise.reject(new Error('oracle failed'))

      // when
      const gasPrice = await fetchGasPrice({
        oracleFn: oracleFnMock
      })

      // then
      expect(gasPrice).to.equal(null)
    })
  })
  describe('start', () => {
    const utils = { setIntervalAndRun: sinon.spy() }
    beforeEach(() => {
      utils.setIntervalAndRun.resetHistory()
    })
    it('should call setIntervalAndRun with FOREIGN_GAS_PRICE_UPDATE_INTERVAL interval value on Foreign', async () => {
      // given
      process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL = 15000
      const gasPrice = proxyquire('../src/services/gasPrice', { '../utils/utils': utils })

      // when
      await gasPrice.start('foreign')

      // then
      expect(process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL).to.equal('15000')
      expect(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL).to.not.equal(
        DEFAULT_UPDATE_INTERVAL.toString()
      )
      expect(utils.setIntervalAndRun.args[0][1]).to.equal(
        process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL.toString()
      )
    })
  })
})
