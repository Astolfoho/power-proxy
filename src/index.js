"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const net = __importStar(require("net"));
const fs = __importStar(require("fs"));
const ssl = __importStar(require("ssl-utils"));
const events = __importStar(require("events"));
let privateKeyPath = __dirname + '//server.key';
let certificatePath = __dirname + '//server.crt';
class PowerProxy {
    constructor() {
        this._servers = {};
        this._ee = new events.EventEmitter();
        this.initServers();
    }
    initServers() {
        var privateKey = fs.readFileSync(__dirname + '//server.key').toString();
        var certificate = fs.readFileSync(__dirname + '//server.crt').toString();
        var options = {
            key: privateKey,
            cert: certificate
        };
        this._servers.http = http.createServer(this.httpHandler.bind(this));
        this._servers.https = https.createServer(options, this.httpHandler.bind(this));
    }
    getProxyCall(socket) {
        var as = socket;
        if (!as.proxyCall) {
            as.proxyCall = new ProxyCall();
        }
        return as.proxyCall;
    }
    listen(port, callback) {
        this._server = net.createServer(this.rawHandler.bind(this));
        this._callback = callback;
        this._server.listen(port);
    }
    rawHandler(socket) {
        socket.once('data', buffer => {
            socket.pause();
            let byte = buffer[0];
            let protocol = "";
            let str = this.readBufferAsString(buffer);
            if (str.indexOf("CONNECT") === 0) {
                //this.handleConnect(socket,str);
                let host = this.getConnectHostName(str);
                socket.encrypted = true;
                socket.on('error', () => { });
                if (this._servers[host]) {
                    this.proceed(host, socket);
                }
                else {
                    this.createServerAndProceed(host, socket);
                }
                return;
            }
            else if (str.indexOf(":443") != -1) {
                protocol = 'https';
            }
            else if (32 < byte && byte < 127) {
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
    proceed(host, socket) {
        socket.write("HTTP/1.1 200 Connection established\n\n");
        this._servers[host].emit('connection', socket);
        socket.resume();
    }
    createServerAndProceed(host, socket) {
        let certInfo = {
            subject: {
                C: 'US',
                ST: 'FL',
                L: 'Hollywood',
                O: 'es128',
                OU: 'me',
                CN: host
            },
            subjectaltname: `DNS:${host}`
        };
        ssl.generateCertBuffer("_temp", false, certInfo, privateKeyPath, certificatePath, (err, key, cert) => {
            var options = {
                key: key,
                cert: cert
            };
            this._servers[host] = https.createServer(options, this.httpHandler.bind(this));
            this.proceed(host, socket);
        });
    }
    handleConnect(incomingSocket, buffer) {
        //console.log(buffer);
        var reg = /^(.*)\ (.*)\:[0-9]* (.*)$/gmi;
        var regRes = reg.exec(buffer);
        if (regRes) {
            var host = regRes[2];
            var outcomingSocket = new net.Socket();
            var opt = {
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
            outcomingSocket.connect(opt);
        }
    }
    getConnectHostName(rawRequest) {
        let host = "";
        var reg = /^(.*)\ (.*)\:[0-9]* (.*)$/gmi;
        var regRes = reg.exec(rawRequest);
        if (regRes) {
            host = regRes[2];
        }
        return host;
    }
    readBufferAsString(buffer) {
        var str = "";
        buffer.forEach(element => {
            str += String.fromCharCode(element);
        });
        return str;
    }
    httpHandler(req, resp) {
        var call = this.getProxyCall(req.socket);
        if (this._callback) {
            this._callback(call);
        }
        var preq = {
            host: req.headers["host"] || "",
            method: req.method || "GET?",
            path: req.url || "",
        };
        call.emit("client-request", preq);
        var opt = { headers: {} };
        for (var k in req.headers) {
            if (opt.headers) {
                opt.headers[k] = req.headers[k];
            }
        }
        opt.host = req.headers["host"];
        opt.path = req.url;
        opt.method = req.method;
        var client = undefined;
        if (req.connection.encrypted) {
            client = https;
        }
        else {
            client = http;
        }
        var cReq = client.request(opt, (res) => {
            resp.writeHead(res.statusCode || 200, res.statusMessage || "OK", res.headers);
            res.on('data', (chunk) => {
                resp.write(chunk);
            });
            res.on('end', () => resp.end());
        });
        if (opt.method == "GET") {
            cReq.end();
            call.emit("client-request-end");
        }
        else {
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
exports.PowerProxy = PowerProxy;
process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
});
class ProxyCall {
    constructor() {
        //private _ee: { [id: string] : Array<(...args: any[]) => void> } = {};
        this._ee = new events.EventEmitter();
    }
    on(event, callback) {
        this._ee.on(event, callback);
        // if (!callback) { return this;} 
        // this._ee[event] = this._ee[event] || [];
        // this._ee[event].push(callback);   
        return this;
    }
    emit(event, ...args) {
        events.EventEmitter.prototype.emit.apply(this._ee, arguments);
        // if(this._ee[event]){
        //     this._ee[event].forEach((cb) => {
        //         cb(args);
        //     });
        // }
        return this;
    }
}
//var proxy = new PowerProxy();
//proxy.listen(8888);
//# sourceMappingURL=index.js.map