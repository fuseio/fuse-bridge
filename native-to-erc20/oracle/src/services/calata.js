require('dotenv').config()
const fetch = require('node-fetch')
const {
    CALATA_SCORE_URL,
    CALATA_AUTH_TOKEN
} = process.env

async function getCalataScore(address){
    const response = await fetch(`${CALATA_SCORE_URL}/${address}`, {
        method:'GET',
        headers: new fetch.Headers({ Authorization: CALATA_AUTH_TOKEN })
    })
    const json = await response.json()
    if(response.status !== 200 || json['Score'] !== true && json['Score'] !== false){
        throw new Error('Calata: API returned an invalid response')
    }
    return json['Score']
}

async function main() {
    if(process.argv.length !== 3){
        console.error(`Usage: node ${process.argv[1]} ADDRESS`)
        throw new Error('Usage Error')
    }
    const address = process.argv[2]
    console.log('Calata score: ', await getCalataScore(address))
}

if(require.main === module){
    main().then().catch(console.error)
}

module.exports = {
    getCalataScore
}