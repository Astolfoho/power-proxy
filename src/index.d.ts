/// <reference types="node" />
export declare class PowerProxy {
    private _callback?;
    private _ee;
    private _servers;
    private _server?;
    constructor();
    private initServers();
    private getProxyCall(socket);
    listen(port: number, callback?: (call: IProxyCall) => void): void;
    private rawHandler(socket);
    private proceed(host, socket);
    private createServerAndProceed(host, socket);
    private handleConnect(incomingSocket, buffer);
    private getConnectHostName(rawRequest);
    private readBufferAsString(buffer);
    private httpHandler(req, resp);
}
export interface IProxyRequest {
    method: string;
    host: string;
    path: string;
}
export interface IProxyCall {
    on(event: "client-request", callback: (request: IProxyCallRequest) => void): IProxyCall;
    on(event: "client-request-data", callback: (data: Buffer) => void): IProxyCall;
    on(event: "client-request-end", callback: () => void): IProxyCall;
    on(event: "client-response", callback: () => void): IProxyCall;
    on(event: "client-response-data", callback: (data: Buffer) => void): IProxyCall;
    on(event: "client-response-data-finish", callback: () => void): IProxyCall;
}
export interface IProxyCallRequest {
    host: string;
    path: string;
    method: string;
}
