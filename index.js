"use strict";
var net = require('net');
var Op;
(function (Op) {
    Op[Op["pathSymbols"] = 0] = "pathSymbols";
    Op[Op["pathSymbolsQ"] = 1] = "pathSymbolsQ";
    Op[Op["watchX"] = 2] = "watchX";
})(Op || (Op = {}));
(function (CallbackAction) {
    CallbackAction[CallbackAction["getSymbols"] = 0] = "getSymbols";
})(exports.CallbackAction || (exports.CallbackAction = {}));
var CallbackAction = exports.CallbackAction;
;
var stringToOp = {
    "path-symbols": Op.pathSymbols,
    "path-symbols?": Op.pathSymbolsQ,
    "watch!": Op.watchX
};
function createSocket() {
    var socket = new net.Socket();
    socket.setEncoding('utf8');
    return socket;
}
var Connection = (function () {
    function Connection(port, host) {
        if (port === void 0) { port = 10999; }
        if (host === void 0) { host = '127.0.0.1'; }
        this.port = port;
        this.host = host;
        this.socket = null;
        this.pathSymbols = {};
        this.callback = null;
    }
    Connection.prototype.connect = function (callback) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.socket) {
                return resolve();
            }
            _this.callback = callback;
            _this.socket = createSocket();
            _this.socket.connect(_this.port, _this.host, function () {
                return resolve();
            });
            _this.socket.on('error', function (error) {
                _this.socket = null;
                reject(error);
            });
            _this.socket.on('close', function () {
            });
            _this.socket.on('data', function (data) {
                var msg = _this.parseText(data);
                _this.interpretMessage(msg);
                if (msg.op == Op.pathSymbols) {
                    if (_this.callback) {
                        callback(CallbackAction.getSymbols, msg);
                    }
                }
            });
        });
    };
    Connection.prototype.close = function () {
        this.socket.end();
        this.socket = null;
    };
    Connection.prototype.unref = function () {
        this.socket.unref();
    };
    Connection.prototype.getPathSymbols = function (path) {
        return this.pathSymbols[path] || null;
    };
    Connection.prototype.getAllPathSymbols = function () {
        return this.pathSymbols;
    };
    Connection.prototype.watch = function (wildcard) {
        var msg = this.makeWatchMessage(wildcard);
        this.socket.write(msg);
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
            case Op.pathSymbols:
                return this.parsePathSymbols(msg);
            default:
                return null;
        }
    };
    Connection.prototype.parsePathSymbols = function (msg) {
        var lines = msg.payload.split('\r\n');
        if (lines.length != 2) {
            throw "parse_error";
        }
        return { op: msg.op,
            path: lines[0],
            symbols: JSON.parse(lines[1]) };
    };
    Connection.prototype.makeMessage = function (op, payload) {
        return [op, ' ', payload.length, '\r\n', payload, '\r\n'].join('');
    };
    Connection.prototype.makeGetSymbolsMessage = function (path) {
        return this.makeMessage('path-symbols?', path);
    };
    Connection.prototype.makeWatchMessage = function (wildcard) {
        return this.makeMessage('watch!', wildcard);
    };
    Connection.prototype.interpretMessage = function (msg) {
        switch (msg.op) {
            case Op.pathSymbols:
                this.pathSymbols[msg.path] = msg.symbols;
                break;
            default:
                console.log('Unknown message: ', msg.op);
        }
    };
    return Connection;
}());
exports.Connection = Connection;
