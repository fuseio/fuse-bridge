require('dotenv').config()
const { GraphQLClient } = require('graphql-request')

const { HOME_GRAPH_URL, FOREIGN_GRAPH_URL } = process.env

const graphClientHome = new GraphQLClient(HOME_GRAPH_URL)
const graphClientForeign = new GraphQLClient(FOREIGN_GRAPH_URL)

module.exports = {
  graphClientHome,
  graphClientForeign
}
