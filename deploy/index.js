const fs = require('fs')
const path = require('path')

async function main() {
  const deployResultsPath = path.join(__dirname, './bridgeDeploymentResults.json')
  const deployHome = require('./src/factories/home')
  const deployForeign = require('./src/factories/foreign')

  const { homeFactory, mapper } = await deployHome()
  const { foreignFactory } = await deployForeign()

  console.log('\nDeployment has been completed.\n\n')
  console.log(`[   Home  ] HomeFactory: ${homeFactory.address} at block ${homeFactory.deployedBlockNumber}`)
  console.log(`[   Home  ] BridgeMapper: ${mapper.address} at block ${mapper.deployedBlockNumber}`)
  console.log(`[ Foreign ] ForeignFactory: ${foreignFactory.address} at block ${foreignFactory.deployedBlockNumber}`)
  fs.writeFileSync(
    deployResultsPath,
    JSON.stringify(
      {
        homeFactory: {
          ...homeFactory,
          mapper
        },
        foreignFactory: {
          ...foreignFactory
        }
      },
      null,
      4
    )
  )
  console.log('Contracts Deployment have been saved to `bridgeDeploymentResults.json`')
}

main().catch(e => console.error('Error:', e))
