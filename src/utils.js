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