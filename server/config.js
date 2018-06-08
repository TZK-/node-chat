const path = require('path');

const config = {
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || null
    },
    express: {
        public_path: path.join(__dirname, "../public"),
        port: process.env.PORT || 5000
    },
    github: {
        secret: process.env.OAUTH_SECRET || ''
    },
    message_to_keep: 100,
    secret: process.env.SECRET || 'AZERTYUI'
};

module.exports = config;
