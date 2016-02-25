
var fs = require('fs');
var whatels = require('../index.js');

const path = process.argv[2];
if (!path) {
    console.log('usage: node client.js wildcard');
    process.exit(1);
}

var w = new whatels.Connection();
w.connect().then(
    () => {
        console.log('connected');
        w.watch(path);
        setInterval(() => {
            const allPathSymbols = w.getAllPathSymbols();
            for (var path in allPathSymbols) {
                console.log(path, ': ', allPathSymbols[path]);
            }
        }, 3000);
    },
    err => console.error(err)
);