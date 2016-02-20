/// <reference path="typings/tsd.d.ts" />

import net = require('net');

enum Op {
    symbols,
    symbolsQ
}

export interface Message {
    op: Op;
    payload: string;
}

export interface FunctionInfo {
    name: string;
    line: number;
}

export interface Symbols {
    functions: FunctionInfo[];
}

export interface SymbolsMessage {
    op: Op;
    symbols: Symbols;
}

const stringToOp: any = {
    "SYMBOLS": Op.symbols,
    "SYMBOLS?": Op.symbolsQ
}

export class Connection {
    private socket: net.Socket = null;

    constructor(private port: number = 10999,
                private host: string = '127.0.0.1') {}

    public connect(callback: Function) {
        this.socket = new net.Socket();
        this.socket.connect(this.port, this.host, () => {
            this.socket.setEncoding('utf8');
            return callback(false);
        });
        this.socket.once('error', (error: any) => {
            callback(error);
        });
    }

    public close() {
        this.socket.end();
        this.socket = null;
    }

    public unref() {
        this.socket.unref();
    }

    public getSymbols(path: string, callback: Function) {
        this.socket.write(this.makeGetSymbolsMessage(path));
        this.socket.once('data', (data: string) => {
            const msg = this.parseText(data);
            if (msg === null) {
                callback('parse_error', '');
            }
            else {
                callback(null, msg.symbols);
            }
        });
        this.socket.once('error', (error: any) => {
            callback(error, []);
        })
    }

    private parseText(text: string) {
        try {
            const flipFlop = this.extractFlipFlop(text);
            return this.parseMessage(flipFlop.msg);
        }
        catch (ex) {
            console.log('Ex', ex);
            return null;
        }
    }

    private extractFlipFlop(text: string) {
        const flipIndex = text.indexOf("\r\n");
        if (flipIndex <= 0) {
            return {msg: null, remaining: text};
        }
        const flip = this.parseFlip(text.substring(0, flipIndex));
        const endOfPayload = flipIndex + 2 + flip.payloadLen + 2;
        if (text.length < endOfPayload) {
            return {msg: null, remaining: text};
        }
        const payload = text.substr(flipIndex + 2, flip.payloadLen);
        return {
            msg: {op: flip.op, payload: payload},
            remaining: text.substring(endOfPayload)
        }
    }

    private parseFlip(flip: string) {
        const parts = flip.split(" ", 2);
        if (parts.length != 2) {
            throw "parse_error";
        }
        const op: Op = stringToOp[parts[0]];
        const payloadLen = parseInt(parts[1]);
        if (isNaN(payloadLen)) {
            throw "parse_error";
        }
        return {op: op, payloadLen: payloadLen};
    }


    private parseMessage(msg: Message) {
        switch (msg.op) {
            case Op.symbols:
                return {
                    op: msg.op,
                    symbols: this.transformSymbols(JSON.parse(msg.payload))
                };
            default:
                return null;
        }
    }

    private transformSymbols(symbols: any) {
        let newSymbols: Symbols = {
            functions: []
        };
        newSymbols.functions = (symbols['functions'] || []).map((f: any) => {
            return {
                name: f['name'] + '/' + f.arity,
                line: f.line};
        });
        return newSymbols;
    }

    private makeMessage(op: string, payload: string) {
        return [op, ' ', payload.length, '\r\n', payload, '\r\n'].join('');
    }

    private makeGetSymbolsMessage(path: string) {
        return this.makeMessage('SYMBOLS?', path);
    }
}