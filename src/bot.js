const { Client } = require('nakamura')
const { Logger, refreshDiscord, refreshSpotify, isActive } = require('./utils')
const logger = new Logger('bot')
const axios = require('axios')
const qs = require('querystring')

const parties = {}

module.exports.start = async (env, db) => {
    const client = new Client(env.DISCORD_TOKEN, { debug: false, cache: { guilds: true } })

    client.on('loaded', _ => logger.log(`Logged in as ${client.user.username}#${client.user.discriminator}; ${client._shards.get(0).guildCount} servers`))

    client.on('messageCreate', async message => {
        // i know, i know. this is not the best way to handle commands, but this bot doesn't need a full handler
        // hi, this is me a full day later. i totally need a full handler
        if (message.content.toLowerCase() === 'la!link') {
            const data = await db.collection('data').findOne({
                id: message.author.id
            })
            if (data === null || data.connectedAccount === undefined)
                return client.createMessage(message.channel_id, `You don't have a Spotify account connected. Go to https://labsbm.cyber28.xyz/login and log in with your Discord **and** Spotify accounts.`)
            return client.createMessage(message.channel_id, `You are connected as ${data.connectedAccount}`)
        }

        if (message.content.toLowerCase() === 'la!skip') {
            const data = await db.collection('data').findOne({
                id: message.author.id
            })
            if (data.spotifyTokens.expires_in < Date.now()) {
                const tks = await refreshSpotify(env, data.spotifyTokens.refresh_token)
                const tokens = Object.assign(tks.data, { refresh_token: data.spotifyTokens.refresh_token })
                data.spotifyTokens = tokens // <- changed cached data too
                db.collection('data').findOneAndUpdate(
                    { id: message.author.id },
                    {
                        $set: {
                            spotifyTokens: tokens
                        }
                    }
                )
            }
            const res = await axios({
                method: 'post',
                url: 'https://api.spotify.com/v1/me/player/next',
                headers: {
                    'Authorization': `Bearer ${data.spotifyTokens.access_token}`
                }
            }).catch(r => console.log(r.response.data.error))
            // how about ya handle this error properly?
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
            return
        }

        if (message.content.toLowerCase() === 'la!connect') {
            const data = await db.collection('data').findOne({
                id: message.author.id
            })
            if (data === null || data.connectedAccount === undefined)
                return client.createMessage(message.channel_id, `You don't have a Spotify account connected. Go to https://labsbm.cyber28.xyz/login and log in with your Discord **and** Spotify accounts.`)
            if (data.spotifyTokens.expires_in < Date.now()) {
                const tks = await refreshSpotify(env, data.spotifyTokens.refresh_token)
                const tokens = Object.assign(tks.data, { refresh_token: data.spotifyTokens.refresh_token })
                data.spotifyTokens = tokens // <- changed cached data too
                db.collection('data').findOneAndUpdate(
                    { id: message.author.id },
                    {
                        $set: {
                            spotifyTokens: tokens
                        }
                    }
                )
            }
            isActive(env, data.spotifyTokens.access_token).catch(r => console.log(r))
            const active = await isActive(env, data.spotifyTokens.access_token)
            if (!active) {
                delete parties[message.author.id]
                return client.createMessage(message.channel_id, '❌ You are currently not playing anything on Spotify.')
            }
            if (parties[message.author.id])
                return client.createMessage(message.channel_id, '⚠️ I am already connected to your Listening Party!')
            parties[message.author.id] = new Set()
            return client.createMessage(message.channel_id, '✅ Successfully connected to your Listening Party!')
        }

        if (message.content.toLowerCase() === 'la!disconnect') {
            if (!parties[message.author.id])
                return client.createMessage(message.channel_id, '⚠️ I am not connected to your Listening Party!')
            delete parties[message.author.id]
            return client.createMessage(message.channel_id, '👋 Successfully disconnected from your Listening Party!')
        }

        if (message.content.toLowerCase().startsWith('la!allow')) {
            if (message.mentions.length == 0)
                return client.createMessage(message.channel_id, '❌ You need to mention someone. Example: `la!allow @friend`')
            if (!parties[message.author.id])
                parties[message.author.id] = new Set()
            if (parties[message.author.id].has(message.mentions[0].id))
                return client.createMessage(message.channel_id, `⚠️ ${message.mentions[0].username} is already allowed to skip songs in your Listening Party`)
            parties[message.author.id].add(message.mentions[0].id)
            return client.createMessage(message.channel_id, `✅ ${message.mentions[0].username} is now allowed to skip songs in your Listening Party!`)
        }

        if (message.content.toLowerCase().startsWith('la!disallow')) {
            if (message.mentions.length == 0)
                return client.createMessage(message.channel_id, '❌ You need to mention someone. Example: `la!disallow @friend`')
            if (!parties[message.author.id])
                return client.createMessage(message.channel_id, '❌ I need to be connected to your Listening Party. Run `la!connect`')
            if (!parties[message.author.id].has(message.mentions[0].id))
                return client.createMessage(message.channel_id, `❌ ${message.mentions[0].username} is not even allowed to skip songs in your Listening Party`)
            parties[message.author.id].remove(message.mentions[0].id)
            return client.createMessage(message.channel_id, `✅ ${message.mentions[0].username} is no longer allowed to skip songs in your Listening Party!`)
        }
    })

    client.connect()
}