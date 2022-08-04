require('dotenv').config()
const { isBooleanable } = require('boolean')
const fetch = require('node-fetch')
const {
    ODDIN_SCORE_URL,
    ODDIN_AUTH_TOKEN
} = process.env

async function getOddinScore(address){
    const response = await fetch(`${ODDIN_SCORE_URL}/${address}`, {
        method:'GET',
        headers: new fetch.Headers({ Authorization: ODDIN_AUTH_TOKEN })
    })
    const json = await response.json()
    if (response.status !== 200 || !isBooleanable(json['Score'])) {
        throw new Error('Oddin: API returned an invalid response')
    }
    return json['Score']
}

async function main() {
    if(process.argv.length !== 3){
        console.error(`Usage: node ${process.argv[1]} ADDRESS`)
        throw new Error('Usage Error')
    }
    const address = process.argv[2]
    console.log('Oddin score: ', await getOddinScore(address))
}

if(require.main === module){
    main().then().catch(console.error)
}

module.exports = {
    getOddinScore
}