const redis = require("redis");
const config = require("./config");
const { promisify } = require("util");
const http = require("http");
const app = require("./express");
const WebSocket = require("ws");
const redisPublisher = redis.createClient(config.redis);
const redisSubscriber = redis.createClient(config.redis);

const llen = promisify(redisPublisher.llen).bind(redisPublisher);
const rpop = promisify(redisPublisher.rpop).bind(redisPublisher);
const lpush = promisify(redisPublisher.lpush).bind(redisPublisher);
const lrange = promisify(redisPublisher.lrange).bind(redisPublisher);

/* Map<string, Set<WebSocket>> */
const socketsPerChannels = new Map();

/* WeakMap<WebSocket, Set<string> */
const channelsPerSocket = new WeakMap();

function subscribeToChannel(socket, channel) {
    let socketSubscribed = socketsPerChannels.get(channel) || new Set();
    let channelSubscribed = channelsPerSocket.get(socket) || new Set();

    socketSubscribed = socketSubscribed.add(socket);
    channelSubscribed = channelSubscribed.add(channel);

    socketsPerChannels.set(channel, socketSubscribed);
    channelsPerSocket.set(socket, channelSubscribed);

    if (socketSubscribed.size === 1) {
        redisSubscriber.subscribe(channel);
    }

    //reloadCanvas(socket, channel);
}

function unsubscribeFromChannel(socket, channel) {
    let socketSubscribed = socketsPerChannels.get(channel) || new Set();
    let channelSubscribed = channelsPerSocket.get(socket) || new Set();

    socketSubscribed.delete(socket);
    channelSubscribed.delete(channel);

    socketsPerChannels.set(channel, socketSubscribed);
    channelsPerSocket.set(socket, channelSubscribed);

    if (socketSubscribed.size === 0) {
        redisSubscriber.unsubscribe(channel);
    }
}

function unsubscribeFromAllChannel(socket) {
    const channelSubscribed = channelsPerSocket.get(socket) || new Set();

    channelSubscribed.forEach(channel => {
        unsubscribeFromChannel(socket, channel);
    });
}

async function broadcast(channel, data) {
    redisPublisher.publish(channel, data);

    while ((await llen(channel)) >= config.whiteboard.points_to_keep) {
        await rpop(channel);
    }

    await lpush(channel, data);
}

function start() {
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
    app.listen(config.express.port, () => {
        console.log("Server running on port " + config.express.port);
    });

    redisSubscriber.on("message", (channel, message) => {
        const socketSubscribed = socketsPerChannels.get(channel) || new Set();

        socketSubscribed.forEach(client => {
            client.send(message);
        });
    });

    wss.on("connection", ws => {
        ws.on("close", () => {
            unsubscribeFromAllChannel(ws);
        });

        ws.on("message", data => {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case "subscribe":
                    subscribe(ws, message.channel);
                    break;
                default:
                    broadcast(message.channel, data);
                    break;
            }
        });
    });
}

module.exports = {
    start
};
