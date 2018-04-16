import * as https from 'https'
import * as http from 'http'
import * as net from 'net'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as ssl from 'ssl-utils'
import * as events from 'events'

let privateKeyPath = __dirname + '//server.key';
let certificatePath = __dirname + '//server.crt';

export class PowerProxy {
    private _callback?: ((call: IProxyCall) => void);
    private _ee: events.EventEmitter;
    private _servers: { [protocol: string]: any; } = {};
    private _server?: net.Server;

    constructor() {
        this._ee = new events.EventEmitter();
        this.initServers();
    }

    private initServers() {
        var privateKey = fs.readFileSync(__dirname + '//server.key').toString();
        var certificate = fs.readFileSync(__dirname + '//server.crt').toString();

        var options: https.ServerOptions = {
            key: privateKey,
            cert: certificate
        }

        this._servers.http = http.createServer(this.httpHandler.bind(this));
        this._servers.https = https.createServer(options, this.httpHandler.bind(this));
    }

    private getProxyCall(socket: net.Socket): ProxyCall {
        var as = socket as any;
        if (!as.proxyCall) {
            as.proxyCall = new ProxyCall();
        }
        return as.proxyCall;
    }

    public listen(port: number, callback?: (call: IProxyCall) => void) {
        this._server = net.createServer(this.rawHandler.bind(this));
        this._callback = callback;
        this._server.listen(port);
    }

    private rawHandler(socket: net.Socket) {
        socket.once('data', buffer => {
            socket.pause();
            
            let byte = buffer[0];
            let protocol: string = "";
            let str = this.readBufferAsString(buffer);

            

            if (str.indexOf("CONNECT") === 0) {
                //this.handleConnect(socket,str);
                let host = this.getConnectHostName(str);

                (<any>socket).encrypted = true;

                socket.on('error', () => { });

                if (this._servers[host]) {
                    this.proceed(host, socket);
                } else {
                    this.createServerAndProceed(host, socket);
                }

                return;
            }
            else if (str.indexOf(":443") != -1) {
                protocol = 'https';
            } else if (32 < byte && byte < 127) {
                protocol = 'http';
            }

            let proxy = this._servers[protocol];
            if (proxy) {
                socket.unshift(buffer);
                proxy.emit('connection', socket);
            }
            socket.resume();
        });
    }

    private proceed(host: string, socket: net.Socket) {
        socket.write("HTTP/1.1 200 Connection established\n\n");
        this._servers[host].emit('connection', socket);
        socket.resume();
    }

    private createServerAndProceed(host: string, socket: net.Socket) {
        let certInfo: ssl.ICertInfo = {
            subject: {
                C: 'US',
                ST: 'FL',
                L: 'Hollywood',
                O: 'es128',
                OU: 'me',
                CN: host
            },
            subjectaltname: `DNS:${host}`
        }
        ssl.generateCertBuffer("_temp",
            false,
            certInfo,
            privateKeyPath,
            certificatePath,
            (err, key, cert) => {
                var options: https.ServerOptions = {
                    key: key,
                    cert: cert
                }
                this._servers[host] = https.createServer(options, this.httpHandler.bind(this));
                this.proceed(host, socket);
            });

    }

    private handleConnect(incomingSocket: net.Socket, buffer: string) {
        //console.log(buffer);
        var reg = /^(.*)\ (.*)\:[0-9]* (.*)$/gmi
        var regRes = reg.exec(buffer);
        if (regRes) {
            var host = regRes[2];
            var outcomingSocket = new net.Socket();
            var opt: net.TcpSocketConnectOpts = {
                host: `${host}`,
                port: 443
            };
            console.log(host, "https");
            outcomingSocket.on('data', data => {
                //console.log(this.readBufferAsString(data));                
                incomingSocket.write(data);
            });

            incomingSocket.setKeepAlive(true, 7200000);
            incomingSocket.on('error', (err) => console.log(err));
            incomingSocket.on("data", (data) => {
                let byte = data[0];
                //console.log(byte === 22,this.readBufferAsString(data));                
                outcomingSocket.write(data);
            });

            outcomingSocket.setKeepAlive(true, 7200000);
            outcomingSocket.on('error', (err) => console.log(err));
            outcomingSocket.once("connect", () => {
                incomingSocket.resume();
                incomingSocket.write("HTTP/1.1 200 Connection established\n\n");
            });
            outcomingSocket.connect(opt)


        }
    }

    private getConnectHostName(rawRequest: string): string {
        let host = "";
        var reg = /^(.*)\ (.*)\:[0-9]* (.*)$/gmi
        var regRes = reg.exec(rawRequest);
        if (regRes) {
            host = regRes[2];
        }
        return host;
    }

    private readBufferAsString(buffer: Buffer): string {
        var str = "";
        buffer.forEach(element => {
            str += String.fromCharCode(element);
        });
        return str;
    }

    private httpHandler(req: http.IncomingMessage, resp: http.ServerResponse) {
        
        
        var call = this.getProxyCall(req.socket);
        if(this._callback){
            this._callback(call);
        }

        var preq : IProxyCallRequest = {      
            host : req.headers["host"] || "",
            method : req.method || "GET?",
            path : req.url || "",
        }; 

        call.emit("client-request", preq);


        
        var opt: http.RequestOptions = { headers: {} };

        for (var k in req.headers) {
            if (opt.headers) {
                opt.headers[k] = req.headers[k];
            }
        }



        opt.host = req.headers["host"];
        opt.path = req.url;
        opt.method = req.method;

        var client: any = undefined;

        if ((<any>req.connection).encrypted) {
            client = https;
        } else {
            client = http;
        }

        var cReq = client.request(opt, (res: http.ClientResponse) => {
            resp.writeHead(res.statusCode || 200, res.statusMessage || "OK", res.headers);
            res.on('data', (chunk: Buffer) => {
                resp.write(chunk);
            });
            res.on('end', () => resp.end());
        });

        if (opt.method == "GET") {
            cReq.end();
            call.emit("client-request-end");
        } else {
            req.on("data", (data) => {
                call.emit("client-request-data", data);
                cReq.write(data);
            });

            req.on("finish", () => {
                call.emit("client-request-end");
                cReq.end();
            });
        }


        req.socket.on('error', () => { });

        


    }



}

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
});

export interface IProxyRequest {
    method: string;
    host: string;
    path: string;
}

export interface IProxyCall {
    on(event: "client-request", callback: (request:IProxyCallRequest) => void): IProxyCall;
    on(event: "client-request-data", callback: (data: Buffer) => void): IProxyCall
    on(event: "client-request-end", callback: () => void): IProxyCall
    on(event: "client-response", callback: () => void): IProxyCall
    on(event: "client-response-data", callback: (data: Buffer) => void): IProxyCall
    on(event: "client-response-data-finish", callback: () => void): IProxyCall
   
}

class ProxyCall implements IProxyCall {

    //private _ee: { [id: string] : Array<(...args: any[]) => void> } = {};
    private _ee:events.EventEmitter = new events.EventEmitter();


    public on(event: string, callback: (...args: any[]) => void): IProxyCall {  
        this._ee.on(event,callback);
        // if (!callback) { return this;} 
        // this._ee[event] = this._ee[event] || [];
        // this._ee[event].push(callback);   
        return this;
    }

    emit(event: "client-request", request:IProxyCallRequest): IProxyCall;
    emit(event: "client-request-data", data: string | Buffer): IProxyCall
    emit(event: "client-request-end"): IProxyCall
    emit(event: "client-response"): IProxyCall
    emit(event: "client-response-data", data: Buffer): IProxyCall
    emit(event: "client-response-data-finish"): IProxyCall
    public emit(event: string, ...args: any[]): IProxyCall {
        events.EventEmitter.prototype.emit.apply(this._ee, arguments);
        // if(this._ee[event]){
        //     this._ee[event].forEach((cb) => {
        //         cb(args);
        //     });
        // }
        return this;
    }
}

export interface IProxyCallRequest{
    host:string;
    path:string;
    method:string;
}

//var proxy = new PowerProxy();
//proxy.listen(8888);