"use strict";
var net = require('net');
var tmp = require('tmp');
var fs = require('fs');
var Op;
(function (Op) {
    Op[Op["symbols"] = 0] = "symbols";
    Op[Op["symbolsQ"] = 1] = "symbolsQ";
})(Op || (Op = {}));
var stringToOp = {
    "path-symbols": Op.symbols,
    "path-symbols?": Op.symbolsQ
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
        this.tempPath = '';
        this.cleanupCallback = null;
    }
    Connection.prototype.connect = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.socket) {
                _this.close();
            }
            _this.socket = createSocket();
            _this.socket.connect(_this.port, _this.host, function () {
                tmp.file({ keep: true }, function (err, path, fd, cleanup) {
                    if (err) {
                        return reject(err);
                    }
                    console.log('temp path: ', path);
                    _this.tempPath = path;
                    _this.cleanupCallback = cleanup;
                    return resolve();
                });
            });
            _this.socket.on('error', function (error) {
                _this.socket = null;
                reject(error);
            });
            _this.socket.on('close', function () {
                _this.cleanup();
            });
        });
    };
    Connection.prototype.close = function () {
        this.socket.end();
        this.cleanup();
    };
    Connection.prototype.unref = function () {
        this.socket.unref();
    };
    Connection.prototype.getSymbols = function (source) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            fs.writeFile(_this.tempPath, source, function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    _this.getPathSymbols(_this.tempPath).then(function (symbols) { return resolve(symbols); }, function (err) { return reject(err); });
                }
            });
        });
    };
    Connection.prototype.getPathSymbols = function (path) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var dataFun = function (data) {
                _this.socket.removeListener('data', dataFun);
                _this.socket.removeListener('error', errorFun);
                console.log('listener count: ', _this.socket.listenerCount('data'));
                var msg = _this.parseText(data);
                (msg === null) ? reject('parse_error') : resolve(msg.symbols);
            };
            var errorFun = function (error) {
                _this.socket.removeListener('data', dataFun);
                _this.socket.removeListener('error', errorFun);
                reject(error);
            };
            _this.socket.write(_this.makeGetSymbolsMessage(path));
            _this.socket.on('data', dataFun);
            _this.socket.on('error', errorFun);
        });
    };
    Connection.prototype.cleanup = function () {
        if (this.cleanupCallback) {
            this.cleanupCallback();
            this.cleanupCallback = null;
        }
        this.socket = null;
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
    Connection.prototype.makeMessage = function (op, payload) {
        return [op, ' ', payload.length, '\r\n', payload, '\r\n'].join('');
    };
    Connection.prototype.makeGetSymbolsMessage = function (path) {
        return this.makeMessage('path-symbols?', path);
    };
    return Connection;
}());
exports.Connection = Connection;
