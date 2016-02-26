
var fs = require('fs');
var whatels = require('../index.js');

function callback(action, msg) {
    console.log(`CB: ${action} ${msg}`);
}

const path = process.argv[2];
if (!path) {
    console.log('usage: node client.js wildcard');
    process.exit(1);
}

var w = new whatels.Connection(10998);
w.connect(callback).then(
    () => {
        console.log('connected');
        w.watch(path);
    },
    err => console.error(err)
);