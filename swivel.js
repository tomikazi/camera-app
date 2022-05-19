"use strict";

const http = require('http');
const Stream = require('stream').Transform;

// Swivel runs the automatic sweep of the camera through the sequence of given waypoints
// taking pictures at each waypoint.
class Swivel {

    constructor(options) {
        this.broker = options.broker;
        this.port = options.port || 443;
        this.camera = options.camera;
        this.waypoints = options.waypoints || ['c', 'a', 'b'];
        this.frequency = options.frequency || 2500; // millis
        this.duration = options.duration || 2000; // millis
        this.minStay = options.minStay || 10; // secs
        this.maxStay = options.maxStay || 20; // secs
        this.snapshots = {};
        this.count = 0;

        // Kick off auto-swivel...
        this.autoSwivel();
    }

    // Runs a single cycle of auto-swivel from the current waypoint to the next one.
    autoSwivel() {
        // Determine the next waypoint
        let waypoint = this.waypoints[this.count % this.waypoints.length];
        this.count = this.count + 1;

        // Trigger the move to the next waypoint
        this.swivelTo(waypoint);

        // Schedule the next swivel cycle
        this.swivelTimeout = setTimeout(this.autoSwivel.bind(this), this.randomStay() * 1000);
    }

    // Returns random number of seconds between min stay and max stay.
    randomStay() {
        return this.minStay + Math.floor(Math.random() * (this.maxStay - this.minStay));
    }

    // Start taking snapshots with the specified frequency.
    startSnapshots(waypoint) {
        // Move waypoint when starting snapshot on a new point
        this.waypoint = waypoint;
        this.snapshotInterval = setInterval(this.takeSnapshot.bind(this), this.frequency);
        console.log(`Started snapshot on waypoint ${waypoint}`);
    }

    // Stop taking snapshots.
    stopSnapshots() {
        if (this.snapshotTimeout) {
            clearInterval(this.snapshotTimeout);
        }
        if (this.snapshotInterval) {
            clearInterval(this.snapshotInterval);
        }
        console.log(`Stopped snapshot on waypoint ${this.waypoint}`);
    }

    // Swivels the camera to the specified waypoint using REST API.
    swivelTo(waypoint, duration) {
        // Stop taking snapshots...
        this.stopSnapshots();

        let data = JSON.stringify({
            cmd: 'moveTo',
            pos: waypoint,
            duration: duration || this.duration,
        });

        let options = {
            hostname: this.broker,
            port: this.port,
            path: '/camera/api/' + this.camera,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
            },
        };

        let req = http.request(options, res => {
            if (res.statusCode !== 200) {
                console.error(`Did not get OK for a request to move waypoint to ${waypoint}. Code: ${res.statusCode}`);
                res.resume();
            } else {
                // Schedule restart of snapshot taking
                console.log(`Moved waypoint to ${waypoint}`);
                this.snapshotTimeout = setTimeout(this.startSnapshots.bind(this, waypoint), this.duration * 1.4);
            }
        });
        req.on('error', error => {
            console.error(error);
        });

        req.write(data);
        req.end();
    }

    // Takes snapshot image of the camera using REST API.
    takeSnapshot() {
        let options = {
            hostname: this.broker,
            port: this.port,
            path: '/camera/api/' + this.camera + '/snapshot',
            method: 'GET',
            headers: {
                'Content-Type': 'image/png'
            },
        };

        let req = http.request(options, res => {
            if (res.statusCode !== 200) {
                console.error(`Did not get an OK for a request to take snapshot on ${this.waypoint}. Code: ${res.statusCode}`);
                res.resume();
                return;
            }
            let data = new Stream();
            res.on('data', d => {
                data.push(d);
            });
            res.on('end', d => {
                this.snapshots[this.waypoint] = data.read();
            });
        });

        req.on('error', error => {
            console.error(error);
        });
        req.end();
    }

    // Returns the latest snapshot for the specified waypoint
    getSnapshot(waypoint) {
        return this.snapshots[waypoint];
    }

    // Returns the current waypoint camera is pointing to or is en-route to.
    getWaypoint() {
        return this.waypoint;
    }

    // Stops the swivel and snapshot taking
    stop() {
        if (this.swivelTimeout) {
            clearTimeout(this.swivelTimeout);
        }
        this.stopSnapshots();
        console.log('Stopped');
    }

}

module.exports = Swivel;
