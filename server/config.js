const path = require('path');

const config = {
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379
    },
    express: {
        public_path: path.join(__dirname, "../public"),
        port: process.env.PORT || 5000
    },
    github: {
        secret: process.env.OAUTH_SECRET || ''
    },
    message_to_keep: 10,
    secret: 'AZERTHKLANDMKUO17TOL38UH'
};

module.exports = config;
