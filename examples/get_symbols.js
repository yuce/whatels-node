
var fs = require('fs');
var whatels = require('../index.js');

const path = process.argv[2];
if (!path) {
    console.log('usage: node client.js filename.erl');
    process.exit(1);
}

var w = new whatels.Connection();
w.connect().then(
    () => {
        console.log('connected');
        return new Promise((resolve, reject) => {
            fs.readFile(path, 'utf8', (err, data) => {
                return err? reject(err) : resolve(w.getSymbols(data));
            });
        });
    },
    err => console.error(err)
).then(symbols => {
    w.close();
    console.log(symbols);
}, err => console.error(err));
