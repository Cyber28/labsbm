// so idk why querystring fixes everything but it does and i dont want to know why
const qs = require('querystring')
const server = require('fastify')({ logger: false })
const { Logger } = require('./utils')
const logger = new Logger('web')
const axios = require('axios')

module.exports.start = async (env, db) => {
    server.get('/', async (req, rep) => {
        return 'hi'
    })

    server.get('/login', (req, rep) => {
        rep.redirect(`https://discord.com/api/oauth2/authorize?client_id=${env.DISCORD_ID}&redirect_uri=${encodeURIComponent(env.DISCORD_REDIRECT)}&response_type=code&scope=connections%20identify`)
    })

    server.get('/dccb', async (req, rep) => {
        // these http requests could just call 1 function but eh
        const tokens = await axios({
            method: 'post',
            url: 'https://discord.com/api/oauth2/token',
            data: qs.encode({
                client_id: env.DISCORD_ID,
                client_secret: env.DISCORD_SECRET,
                grant_type: 'authorization_code',
                code: req.query.code,
                redirect_uri: env.DISCORD_REDIRECT,
                scope: 'identify connections'
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
        const user = await axios({
            method: 'get',
            url: 'https://discord.com/api/users/@me',
            headers: { Authorization: `Bearer ${tokens.data.access_token}` }
        })
        const connectinos = await axios({ // yes, this is a typo and yes, it's too good to be fixed
            method: 'get',
            url: 'https://discord.com/api/users/@me/connections',
            headers: {
                Authorization: `Bearer ${tokens.data.access_token}`
            }
        })
        //make cool timestamp
        tokens.data.expires_in = Date.now() + tokens.data.expires_in * 1000
        db.collection('data').findOneAndUpdate(
            { id: user.data.id },
            {
                $set: {
                    spotifyConnections: connectinos.data.filter(d => d.type === 'spotify').map(d => d.id),
                    discordTokens: tokens.data
                },
                $setOnInsert: {
                    id: user.data.id
                }
            },
            { upsert: true }
        )
        rep.redirect(`https://accounts.spotify.com/authorize?response_type=code&client_id=${env.SPOTIFY_ID}&scope=user-modify-playback-state%20user-read-playback-state&redirect_uri=${encodeURIComponent(env.SPOTIFY_REDIRECT)}`)
    })

    server.get('/spcb', async (req, rep) => {
        if (req.query.error) {
            logger.log(`shit went wrong: ${req.query.error}`)
            return 'Access denied. Please try logging in again.'
        }
        const tokens = await axios({
            method: 'post',
            url: `https://accounts.spotify.com/api/token`,
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${env.SPOTIFY_ID}:${env.SPOTIFY_SECRET}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: qs.encode({
                grant_type: 'authorization_code',
                code: req.query.code,
                redirect_uri: env.SPOTIFY_REDIRECT
            })
        })
        const user = await axios({
            method: 'get',
            url: 'https://api.spotify.com/v1/me',
            headers: {
                Authorization: `Bearer ${tokens.data.access_token}`
            }
        })
        //make cool timestamp
        tokens.data.expires_in = Date.now() + tokens.data.expires_in * 1000
        db.collection('data').findOneAndUpdate(
            { spotifyConnections: user.data.id },
            {
                $set: {
                    spotifyTokens: tokens.data,
                    connectedAccount: user.data.id
                }
            }
        )
        return 'ok'
    })

    server.listen(8888, '0.0.0.0')
    logger.log('Up and running')
}