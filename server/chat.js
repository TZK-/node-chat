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
const set = promisify(redisPublisher.set).bind(redisPublisher);
const get = promisify(redisPublisher.get).bind(redisPublisher);
const del = promisify(redisPublisher.del).bind(redisPublisher);

/* Map<string, Set<WebSocket>> */
const socketsPerChannels = new Map();

/* WeakMap<WebSocket, Set<string> */
const channelsPerSocket = new WeakMap();

async function subscribeToChannel(socket, channel, userId) {
    let socketSubscribed = socketsPerChannels.get(channel) || new Set();
    let channelSubscribed = channelsPerSocket.get(socket) || new Set();

    socketSubscribed = socketSubscribed.add(socket);
    channelSubscribed = channelSubscribed.add(channel);

    socketsPerChannels.set(channel, socketSubscribed);
    channelsPerSocket.set(socket, channelSubscribed);

    if (socketSubscribed.size === 1) {
        redisSubscriber.subscribe(channel);
    }

    // Add userId in redis channel
    const channelName = "channel_" + channel;

    // TODO: return null all the time. Why The fuck ?
    const users = JSON.parse(await get(channelName) || "[]");

    users.push(userId);
    await set(channelName, JSON.stringify(users));
    const username = await getUsernameFromId(userId);

    broadcast(
        channel,
        JSON.stringify({
            channel: channel,
            type: "connected",
            payload: {
                username: username
            },
            user_id: userId
        })
    );
}

async function getUsernameFromId(userId) {
    return await get("client_" + userId);
}

async function unsubscribeFromChannel(socket, channel, userId) {
    let socketSubscribed = socketsPerChannels.get(channel) || new Set();
    let channelSubscribed = channelsPerSocket.get(socket) || new Set();

    socketSubscribed.delete(socket);
    channelSubscribed.delete(channel);

    socketsPerChannels.set(channel, socketSubscribed);
    channelsPerSocket.set(socket, channelSubscribed);

    if (socketSubscribed.size === 0) {
        redisSubscriber.unsubscribe(channel);
    }

    if (userId !== undefined) {
        // Remove userId in redis channel
        const channelName = "channel_" + channel;
        const users = JSON.parseJSON(await get(channelName));
        const usersWithoutUnsubscriber = users.filter(user => user != userId);

        await set(channelName, JSON.stringify(usersWithoutUnsubscriber));
    }
}

async function unsubscribeFromAllChannel(socket) {
    const channelSubscribed = channelsPerSocket.get(socket) || new Set();

    channelSubscribed.forEach(async channel => {
        unsubscribeFromChannel(socket, channel);
        await del("channel_" + channel);
    });
}

async function broadcast(channel, data) {
    let json = JSON.parse(data);

    json.payload.username = await getUsernameFromId(json.user_id);

    const stringJson = JSON.stringify(json);
    redisPublisher.publish(channel, stringJson);

    while ((await llen(channel)) >= config.message_to_keep) {
        await rpop(channel);
    }

    await lpush(channel, stringJson);
}

function start() {
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });

    server.listen(config.express.port, () => {
        console.log("Server running on port " + config.express.port);
    });

    redisSubscriber.on("message", (channel, data) => {
        const socketSubscribed = socketsPerChannels.get(channel) || new Set();
        socketSubscribed.forEach(client => {
            client.send(data);
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
                    subscribeToChannel(ws, message.channel, message.user_id);
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
