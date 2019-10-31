const fs = require('fs')
const path = require('path')

async function main() {
  const deployResultsPath = path.join(__dirname, './bridgeDeploymentResults.json')
  const deployHome = require('./src/native_to_erc20/home')
  const deployForeign = require('./src/native_to_erc20/foreign')

  const { homeBridge } = await deployHome()
  const { foreignBridge, erc677 } = await deployForeign()

  console.log('\nDeployment has been completed.\n\n')
  console.log(`[   Home  ] HomeBridge: ${homeBridge.address} at block ${homeBridge.deployedBlockNumber}`)
  console.log(`[ Foreign ] ForeignBridge: ${foreignBridge.address} at block ${foreignBridge.deployedBlockNumber}`)
  console.log(`[ Foreign ] ERC677 Bridgeable Token: ${erc677.address}`)
  fs.writeFileSync(
    deployResultsPath,
    JSON.stringify(
      {
        homeBridge: {
          ...homeBridge
        },
        foreignBridge: {
          ...foreignBridge,
          erc677
        }
      },
      null,
      4
    )
  )
  console.log('Contracts Deployment have been saved to `bridgeDeploymentResults.json`')
}

main().catch(e => console.error('Error:', e))
