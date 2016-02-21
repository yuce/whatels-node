
var fs = require('fs');
var whatels = require('../index.js');

const path = process.argv[2];
if (!path) {
    console.log('usage: node client.js filename.erl');
    process.exit(1);
}

var w = new whatels.Connection();
w.connect((error) => {
    if (!error) {
        console.log('connected');
        fs.readFile(path, 'utf8', (err, data) => {
            if (err) {
                console.error(err);
            }
            w.getSymbols(data, (err, symbols) => {
                w.close();
                if (err) {
                    console.error('error during getSymbols: ', err);
                }
                else {
                    console.log(symbols);
                }
            });
        })
    }
    else {
        console.error('error during connect: ', error);
    }
});