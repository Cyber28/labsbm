const { Client } = require('nakamura')
const { Logger, refreshDiscord } = require('./utils')
const logger = new Logger('bot')
const axios = require('axios')
const qs = require('querystring')

module.exports.start = async (env, db) => {
    const client = new Client(env.DISCORD_TOKEN, { debug: false, cache: { guilds: true } })

    client.on('loaded', _ => logger.log(`Logged in as ${client.user.username}#${client.user.discriminator}; ${client._shards.get(0).guildCount} servers`))

    client.on('messageCreate', async message => {
        if (message.content.toLowerCase() === 'la!link') {
            const data = await db.collection('data').findOne({
                id: message.author.id
            })
            if (data === null || data.connectedAccount === undefined)
                return client.createMessage(message.channel_id, `You don't have a connected Spotify account. Head to https://labsbm.cyber28.xyz/login and log in with your Discord **and** Spotify accounts.`)
            client.createMessage(message.channel_id, `You are connected as ${data.connectedAccount}`)
        }
        if (message.content.toLowerCase() === 'la!skip') {
            const data = await db.collection('data').findOne({
                id: message.author.id
            })
            const res = await axios({
                method: 'post',
                url: 'https://api.spotify.com/v1/me/player/next',
                headers: {
                    'Authorization': `Bearer ${data.spotifyTokens.access_token}`
                }
            }).catch(r => console.log(r.response.data.error))
            switch (res.status) {
                case 204:
                    client.createMessage(message.channel_id, `⏩ Skipped`)
                    break;

                case 403:
                case 404:
                default:
                    logger.log(res.data)
                    client.createMessage(message.channel_id, 'Something went wrong. This error has been reported')
            }
        }
    })

    client.connect()
}