const fs = require('fs')
const path = require('path')

async function main() {
  const deployResultsPath = path.join(__dirname, './bridgeUpgradeResults.json')
  const upgradeForeign = require('./src/native_to_erc20/upgrade_foreign')

  const { foreignBridge } = await upgradeForeign()

  console.log('\nUpgrade has been completed.\n\n')
  // console.log(`[   Home  ] HomeBridge: ${homeBridge.address} at block ${homeBridge.deployedBlockNumber}`)
  // console.log(`[ Foreign ] ForeignBridge: ${foreignBridge.address} at block ${foreignBridge.deployedBlockNumber}`)
  // console.log(`[ Foreign ] ERC677 Bridgeable Token: ${erc677.address}`)
  // fs.writeFileSync(
  //   deployResultsPath,
  //   JSON.stringify(
  //     {
  //       homeBridge: {
  //         ...homeBridge
  //       },
  //       foreignBridge: {
  //         ...foreignBridge,
  //         erc677
  //       }
  //     },
  //     null,
  //     4
  //   )
  // )
  // console.log('Contracts Deployment have been saved to `bridgeDeploymentResults.json`')
}



main().catch(e => console.error('Error:', e))
