
import net = require('net');
import tmp = require('tmp');
import fs = require('fs');

enum Op {
    symbols,
    symbolsQ
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
    "path-symbols": Op.symbols,
    "path-symbols?": Op.symbolsQ
}

function createSocket() {
    let socket = new net.Socket();
    socket.setEncoding('utf8');
    return socket;
}

export class Connection {
    private socket: net.Socket = null;
    private tempPath = '';
    private cleanupCallback: Function = null;

    constructor(private port: number = 10999,
                private host: string = '127.0.0.1') {}

    public connect(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.socket) {
                this.close();
            }
            this.socket = createSocket();
            this.socket.connect(this.port, this.host, () => {
                tmp.file({keep: true}, (err, path, fd, cleanup) => {
                    if (err) {
                        return reject(err);
                    }
                    console.log('temp path: ', path);
                    this.tempPath = path;
                    this.cleanupCallback = cleanup;
                    return resolve();
                });
            });
            this.socket.on('error', (error: any) => {
                this.socket = null;
                reject(error);
            });
            this.socket.on('close', () => {
                this.cleanup();
            });
        });
    }

    public close() {
        this.socket.end();
        this.cleanup();
    }

    public unref() {
        this.socket.unref();
    }

    public getSymbols(source: string): Promise<Symbols> {
        return new Promise<Symbols>((resolve, reject) => {
            fs.writeFile(this.tempPath, source, err => {
                if (err) {
                    reject(err);
                }
                else {
                    this.getPathSymbols(this.tempPath).then(
                        symbols => resolve(symbols),
                        err => reject(err)
                    );
                }
            });
        });
    }

    public getPathSymbols(path: string): Promise<Symbols> {
        return new Promise<Symbols>((resolve, reject) => {
            let dataFun = (data: string) => {
                this.socket.removeListener('data', dataFun);
                this.socket.removeListener('error', errorFun);
                console.log('listener count: ', this.socket.listenerCount('data'));
                const msg = this.parseText(data);
                (msg === null)? reject('parse_error') : resolve(msg.symbols);
            }

            let errorFun = (error: any) => {
                this.socket.removeListener('data', dataFun);
                this.socket.removeListener('error', errorFun);
                reject(error);
            };

            this.socket.write(this.makeGetSymbolsMessage(path));
            this.socket.on('data', dataFun);
            this.socket.on('error', errorFun)
        });
    }

    private cleanup() {
        if (this.cleanupCallback) {
            this.cleanupCallback();
            this.cleanupCallback = null;
        }
        this.socket = null;
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
                    symbols: JSON.parse(msg.payload)
                };
            default:
                return null;
        }
    }

    private makeMessage(op: string, payload: string) {
        return [op, ' ', payload.length, '\r\n', payload, '\r\n'].join('');
    }

    private makeGetSymbolsMessage(path: string) {
        return this.makeMessage('path-symbols?', path);
    }
}