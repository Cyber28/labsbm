require('dotenv').config()
const { MongoClient } = require('mongodb')

const bot = require('./src/bot')
const web = require('./src/web')

MongoClient.connect('mongodb://localhost:27017', { useUnifiedTopology: true }, (err, client) => {
    let db = client.db('labsbm')
    bot.start(process.env, db)
    web.start(process.env, db)
})