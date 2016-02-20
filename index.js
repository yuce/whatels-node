/// <reference path="typings/tsd.d.ts" />
"use strict";
var net = require('net');
var Op;
(function (Op) {
    Op[Op["symbols"] = 0] = "symbols";
    Op[Op["symbolsQ"] = 1] = "symbolsQ";
})(Op || (Op = {}));
var stringToOp = {
    "SYMBOLS": Op.symbols,
    "SYMBOLS?": Op.symbolsQ
};
var Connection = (function () {
    function Connection(port, host) {
        if (port === void 0) { port = 10999; }
        if (host === void 0) { host = '127.0.0.1'; }
        this.port = port;
        this.host = host;
        this.socket = null;
    }
    Connection.prototype.connect = function (callback) {
        var _this = this;
        this.socket = new net.Socket();
        this.socket.connect(this.port, this.host, function () {
            _this.socket.setEncoding('utf8');
            return callback(false);
        });
        this.socket.once('error', function (error) {
            callback(error);
        });
    };
    Connection.prototype.close = function () {
        this.socket.end();
        this.socket = null;
    };
    Connection.prototype.unref = function () {
        this.socket.unref();
    };
    Connection.prototype.getSymbols = function (path, callback) {
        var _this = this;
        this.socket.write(this.makeGetSymbolsMessage(path));
        this.socket.once('data', function (data) {
            var msg = _this.parseText(data);
            if (msg === null) {
                callback('parse_error', '');
            }
            else {
                callback(null, msg.symbols);
            }
        });
        this.socket.once('error', function (error) {
            callback(error, []);
        });
    };
    Connection.prototype.parseText = function (text) {
        try {
            var flipFlop = this.extractFlipFlop(text);
            return this.parseMessage(flipFlop.msg);
        }
        catch (ex) {
            console.log('Ex', ex);
            return null;
        }
    };
    Connection.prototype.extractFlipFlop = function (text) {
        var flipIndex = text.indexOf("\r\n");
        if (flipIndex <= 0) {
            return { msg: null, remaining: text };
        }
        var flip = this.parseFlip(text.substring(0, flipIndex));
        var endOfPayload = flipIndex + 2 + flip.payloadLen + 2;
        if (text.length < endOfPayload) {
            return { msg: null, remaining: text };
        }
        var payload = text.substr(flipIndex + 2, flip.payloadLen);
        return {
            msg: { op: flip.op, payload: payload },
            remaining: text.substring(endOfPayload)
        };
    };
    Connection.prototype.parseFlip = function (flip) {
        var parts = flip.split(" ", 2);
        if (parts.length != 2) {
            throw "parse_error";
        }
        var op = stringToOp[parts[0]];
        var payloadLen = parseInt(parts[1]);
        if (isNaN(payloadLen)) {
            throw "parse_error";
        }
        return { op: op, payloadLen: payloadLen };
    };
    Connection.prototype.parseMessage = function (msg) {
        switch (msg.op) {
            case Op.symbols:
                return {
                    op: msg.op,
                    symbols: JSON.parse(msg.payload)
                };
            default:
                return null;
        }
    };
    // private transformSymbols(symbols: any) {
    //     let newSymbols: Symbols = {
    //         functions: []
    //     };
    //     newSymbols.functions = (symbols['functions'] || []).map((f: any) => {
    //         return {
    //             name: f['name'] + '/' + f.arity,
    //             line: f.line};
    //     });
    //     return newSymbols;
    // }
    Connection.prototype.makeMessage = function (op, payload) {
        return [op, ' ', payload.length, '\r\n', payload, '\r\n'].join('');
    };
    Connection.prototype.makeGetSymbolsMessage = function (path) {
        return this.makeMessage('SYMBOLS?', path);
    };
    return Connection;
}());
exports.Connection = Connection;
