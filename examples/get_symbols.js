
const path = process.argv[2];
if (!path) {
    console.log('usage: node client.js filename.erl');
    process.exit(1);
}

var whatels = require('../index.js');
var w = new whatels.Connection();
w.connect((error) => {
    if (!error) {
        console.log('connected');
        w.getSymbols(path, (err, symbols) => {
            w.close();
            if (err) {
                console.error('error during getSymbols: ', err);
            }
            else {
                console.log(symbols);
            }
        });
    }
    else {
        console.error('error during connect: ', error);
    }
});