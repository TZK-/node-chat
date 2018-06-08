const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const uuidv4 = require("uuid/v4");
const redis = require('redis');
const { promisify } = require('util');

const config = require("./config");
const redisPublisher = redis.createClient(config.redis);
const set = promisify(redisPublisher.set).bind(redisPublisher);

const app = express();

app.use("/public", express.static(config.express.public_path));
app.use(session({ secret: config.secret }));
app.use(cookieParser());
app.use(bodyParser());

app.get("/login", (req, res) => {
    res.sendFile(
        path.join(config.express.public_path, "login.html"),
        {},
        err => {
            if (err) {
                next(err);
            }
        }
    );
});

app.post("/login", (req, res) => {
    const { username } = req.body;

    req.session.id = uuidv4();
    set('client_' + req.session.id, username);

    return res.redirect("/");
});

app.get("/", (req, res) => {
    res.redirect("/" + uuidv4());
});

app.get("/:channel", (req, res, next) => {
    res.render("index.ejs", {user_id: req.session.id});
});

module.exports = app;
