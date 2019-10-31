module.exports = {
  networks: {
    ganache: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // eslint-disable-line camelcase
      gasPrice: 1000000000
    }
  },
  solc: {
    version: '0.4.24',
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions : {
      currency: 'USD',
      gasPrice: 1
    }
  }
}
