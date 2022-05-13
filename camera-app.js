"use strict";

const args = require('minimist')(process.argv.slice(2));
const http = require('http');
const express = require('express');
const Swivel = require('./swivel')

const app = express();
const swivel = new Swivel({broker: args.broker, port: args.port, camera: args.camera})
console.log('Started swivel for http://%s:%s/camera/api/%s', args.broker, args.port, args.camera);

app.use('/', express.static(__dirname + '/public'));
app.get('/snapshot/:waypoint', (req, res) => {
    let waypoint = req.params.waypoint.replace(/\.jpg$/, '');
    let snapshot = swivel.getSnapshot(waypoint);
    if (!snapshot) {
        snapshot = '';
    }
    res.status(200).contentType('image/png').send(snapshot);
});
app.get('/waypoint', (req, res) => {
    res.status(200).contentType('text/plain').send(swivel.getWaypoint());
});

const server = http.createServer(app);
server.listen(8000);
console.log('Listening on http://0.0.0.0:8000');

['SIGINT', 'SIGTERM', 'SIGQUIT']
  .forEach(signal => process.on(signal, () => {
    console.log('Process terminated');
    process.exit();
  }));
