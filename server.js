import { coinFlip, coinFlips, countFlips, flipACoin } from "./modules/coin.mjs";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const express = require('express')
const morgan = require('morgan')
const minimist = require('minimist')
const app = express()
const fs = require('fs')
const db = require("./database.cjs")

const args = minimist(process.argv.slice(2))
args["help", "port", "debug", "log"]

const help = (`
server.js [options]
--port	Set the port number for the server to listen on. Must be an integer
            between 1 and 65535.
--debug	If set to true, creates endlpoints /app/log/access/ which returns
            a JSON access log from the database and /app/error which throws 
            an error with the message "Error test successful." Defaults to 
            false.
--log		If set to false, no log files are written. Defaults to true.
            Logs are always written to database.
--help	Return this message and exit.
`)

if (args.help || args.h) {
    console.log(help)
    process.exit(0)
}

// port default to 5555
const port = args.port || process.env.PORT || 5555;
const log = (args.log != "false");

app.use(express.json())
app.use(express.static('./public'));
app.use(express.urlencoded({ extended: true }))

const server = app.listen(port, () => {
    console.log('App is running on port %PORT%'.replace('%PORT%', port))
})

//Log user interaction to database
if (log == true) {
    const WRITESTREAM = fs.createWriteStream('access.log', { flags: 'a' });
    app.use(morgan('combined', { stream: WRITESTREAM }));
}

app.use((req, res, next) => {
    let logData = {
        remoteaddr: req.ip,
        remoteuser: req.user,
        time: Date.now(),
        method: req.method,
        url: req.url,
        protocol: req.protocol,
        httpversion: req.httpVersion,
        status: res.statusCode,
        referer: req.headers['referer'],
        useragent: req.headers['user-agent']
    }
    const stmt = db.prepare('INSERT INTO accesslog (remoteaddr, remoteuser, time, method, url, protocol, httpversion, status, referer, useragent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(logData.remoteaddr, logData.remoteuser, logData.time, logData.method, logData.url, logData.protocol, logData.httpversion, logData.status, logData.referer, logData.useragent);
    next();
})

if (args.debug) {
    app.get('/app/log/access', (req, res) => {
        try {
            const stmt = db.prepare(`SELECT * FROM accesslog`).all();
            res.status(200).json(stmt);
        } catch {
            console.error(e);
        }
    });
    app.get('/app/error', (req, res) => {
        throw new Error('Error test successful.');
    });
}

app.get('/app/', (req, res) => {
    res.statusCode = 200;
    res.statusMessage = 'OK';
    res.writeHead(res.statusCode, {'Content-Type' : 'text/plain'});
    res.end(res.statusCode+ ' ' +res.statusMessage)
});

app.get('/app/flip/', (req, res) => {
    res.status(200);
    const ans = coinFlip();
    const flipResult = {"flip" : ans};
    res.json(flipResult);
});
 
app.get('/app/flips/:number', (req, res) => {
    res.status(200);
    const flips = req.params.number || 1;
    const values = coinFlips(flips);
    const rawjson = {
        "raw" : values,
        "summary": countFlips(values)
    };
    res.json(rawjson)
});

app.get('/app/flip/call/heads', (req, res) => {
    res.status(200);
    res.json(flipACoin('heads'));
});

app.get('/app/flip/call/tails', (req, res) => {
    res.status(200);
    res.json(flipACoin('tails'));
});

app.use(function(req, res){
    res.status(404).send('404 NOT FOUND')
});