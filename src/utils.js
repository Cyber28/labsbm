const axios = require('axios')
const qs = require('querystring')

module.exports.Logger = class Logger {
    constructor(name) {
        this.name = name
    }

    log(s) {
        console.log(`[${this.name}] ${s}`)
    }
}

module.exports.refreshDiscord = (env, token) => axios({
    method: 'post',
    url: 'https://discord.com/api/oauth2/token',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: qs.encode({
        client_id: env.DISCORD_ID,
        client_secret: env.DISCORD_SECRET,
        grant_type: 'refresh_token',
        refresh_token: token,
        redirect_uri: env.DISCORD_REDIRECT,
        scope: 'identify connections'
    })
})

module.exports.refreshSpotify = (env, token) => axios({
    method: 'post',
    url: 'https://accounts.spotify.com/api/token',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${env.SPOTIFY_ID}:${env.SPOTIFY_SECRET}`).toString('base64')
    },
    data: qs.encode({
        grant_type: 'refresh_token',
        refresh_token: token
    })
})

module.exports.isActive = (env, token) => new Promise(async (res, rej) => {
    const d = await axios({
        method: 'get',
        url: 'https://api.spotify.com/v1/me/player',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    res(d.data.is_playing && !d.data.device.is_restricted)
})

// this is disgusting wtf
module.exports.skip = async (env, db, id, client, message) => {
    const data = await db.collection('data').findOne({
        id: id
    })
    if (data.spotifyTokens.expires_in < Date.now()) {
        const tks = await this.refreshSpotify(env, data.spotifyTokens.refresh_token)
        const tokens = Object.assign(tks.data, { refresh_token: data.spotifyTokens.refresh_token })
        data.spotifyTokens = tokens // <- changed cached data too
        db.collection('data').findOneAndUpdate(
            { id: id },
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