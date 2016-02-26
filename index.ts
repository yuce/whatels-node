
import net = require('net');
import fs = require('fs');

enum Op {
    pathSymbols,
    pathSymbolsQ,
    watchX
}

export interface Message {
    op: Op;
    payload: string;
}

export interface FunctionInfo {
    module: string;
    name: string;
    arity: number;
    line: number;
}

export interface ErrorInfo {
    error: string;
    line: number;
}

export interface Symbols {
    module: string;
    functions: FunctionInfo[];
    errors: ErrorInfo[];
}

export interface SymbolsMessage {
    op: Op;
    symbols: Symbols;
}

const stringToOp: any = {
    "path-symbols": Op.pathSymbols,
    "path-symbols?": Op.pathSymbolsQ,
    "watchX": Op.watchX
}

function createSocket() {
    let socket = new net.Socket();
    socket.setEncoding('utf8');
    return socket;
}

export class Connection {
    private socket: net.Socket = null;
    private pathSymbols: {[index: string]: Symbols} = {};

    constructor(private port: number = 10999,
                private host: string = '127.0.0.1') {}

    public connect(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.socket) {
                this.close();
            }
            this.socket = createSocket();
            this.socket.connect(this.port, this.host, () => {
                return resolve();
            });
            this.socket.on('error', (error: any) => {
                this.socket = null;
                reject(error);
            });
            this.socket.on('close', () => {
            });
            this.socket.on('data', (data: string) => {
                const msg = this.parseText(data);
                this.interpretMessage(msg);
            });
        });
    }

    public close() {
        this.socket.end();
        this.socket = null;
    }

    public unref() {
        this.socket.unref();
    }

    public getPathSymbols(path: string): Symbols {
        return this.pathSymbols[path] || null;
    }

    public getAllPathSymbols() {
        return this.pathSymbols;
    }

    public watch(wildcard: string) {
        const msg = this.makeWatchMessage(wildcard);
        this.socket.write(msg);
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
            case Op.pathSymbols:
                return this.parsePathSymbols(msg);
            default:
                return null;
        }
    }

    private parsePathSymbols(msg: Message) {
        let lines = msg.payload.split('\r\n');
        if (lines.length != 2) {
            throw "parse_error";
        }
        return {op: msg.op,
                path: lines[0],
                symbols: JSON.parse(lines[1])};
    }

    private makeMessage(op: string, payload: string) {
        return [op, ' ', payload.length, '\r\n', payload, '\r\n'].join('');
    }

    private makeGetSymbolsMessage(path: string) {
        return this.makeMessage('path-symbols?', path);
    }

    private makeWatchMessage(wildcard: string) {
        return this.makeMessage('watch!', wildcard);
    }

    private interpretMessage(msg: any) {
        switch (msg.op) {
            case Op.pathSymbols:
                this.pathSymbols[msg.path] = msg.symbols;
                break;
            default:
                console.log('Unknown message: ', msg.op);
        }
    }
}