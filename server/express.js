const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const uuidv4 = require("uuid/v4");

const config = require("./config");
const app = express();

app.use('/public', express.static(config.express.public_path));
app.use(bodyParser());
app.use(cookieParser());

app.get('/login', (req, res) => {
    res.sendFile(path.join(config.express.public_path, "login.html"), {}, err => {
        if (err) {
            next(err);
        }
    });
});

app.post('/login', (req, res) => {
    const { login } = req.query;


    return res.redirect('/');
});

app.get("/", (req, res) => {
    res.redirect('/' + uuidv4());
});

app.get("/:channel", (req, res, next) => {
    res.sendFile(path.join(config.express.public_path, "index.html"), {}, err => {
        if (err) {
            next(err);
        }
    });
});

module.exports = app;
