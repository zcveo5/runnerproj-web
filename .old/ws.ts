export interface AuthPayload {
    username?: string;
    password?: string;
    token?: string;
    [key: string]: unknown;
}

export interface AuthResponseData {
    status: string;
    username: string;
    token?: string;
    [key: string]: unknown;
}

export interface WsRequest {
    action: string;
    payload: Record<string, unknown>;
    rid: number;
}

export interface WsResponse<T = unknown> {
    rid: number;
    status: 'ok' | 'error';
    payload?: any;
    desc?: string;
}

export class WsClient {
    private wsUri: string;
    public websocket!: WebSocket;
    private requests: Map<number, (value: WsResponse<any>) => void> = new Map();
    private reqId: number = 0;

    public isAuthorized: boolean = false;
    public authPromise: Promise<WsResponse<AuthResponseData> | null> | null = null;

    // Промис, который разрешается, когда сокет открылся (onopen)
    private isReady: Promise<void> | null = null;
    private resolveReady: (() => void) | null = null;

    private currentAuthPayload: AuthPayload | null = null;

    constructor(urlPath: string) {
        this.wsUri = 'ws://' + window.location.host + urlPath;
        this.connect();
    }

    private connect(): void {
        console.log('Connecting to WebSocket...');

        // Создаем новый промис готовности соединения
        this.isReady = new Promise((resolve) => {
            this.resolveReady = resolve;
        });

        this.websocket = new WebSocket(this.wsUri);

        this.websocket.onopen = async () => {
            console.log('WebSocket network channel established.');
            // Сигнализируем, что сокет готов принимать сообщения
            if (this.resolveReady) {
                this.resolveReady();
            }

            if (this.currentAuthPayload) {
                console.log('Re-authenticating automatically...');
                this.authPromise = this.sendAuthRequest(this.currentAuthPayload);
            }
        };

        this.websocket.onmessage = (event: MessageEvent) => {
            const response: WsResponse = JSON.parse(event.data);
            const resolve = this.requests.get(response.rid);
            if (resolve) {
                console.debug(`Received: ${response.rid}`)
                resolve(response);
                this.requests.delete(response.rid);
            } else {
                console.warn(`No such rid: ${response.rid}, promises: ${this.requests}`)
            }
        };

        this.websocket.onclose = (event: CloseEvent) => {
            console.warn(`WebSocket connection lost (code: ${event.code}). Reconnecting...`);
            this.isAuthorized = false;
            this.authPromise = null;
            this.requests.clear();
            setTimeout(() => this.connect(), 3000);
        };

        this.websocket.onerror = () => {
            this.websocket.close();
        };
    }

    private async _sendAndAwait<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<WsResponse<T>> {
        // Дожидаемся, пока сокет перейдет в состояние OPEN
        if (this.isReady) {
            await this.isReady;
        }

        // Проверяем статус на случай, если он успел закрыться
        if (this.websocket.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not in OPEN state.');
        }

        this.reqId++;

        const messageWithId: WsRequest = {
            action: action,
            payload: payload,
            rid: this.reqId
        };

        console.debug(`Send: ${this.reqId} ${action}`)

        return new Promise((resolve) => {
            this.requests.set(this.reqId, resolve as (value: WsResponse<unknown>) => void);
            this.websocket.send(JSON.stringify(messageWithId));
        });
    }

    private async sendAuthRequest(authPayload: AuthPayload): Promise<WsResponse<AuthResponseData> | null> {
        const response = await this._sendAndAwait<AuthResponseData>('auth', authPayload as Record<string, unknown>);
        if (response && response.status === 'ok') {
            this.isAuthorized = true;
            return response;
        }
        this.isAuthorized = false;
        return response;
    }

    public async login(authPayload: AuthPayload): Promise<WsResponse | null> {
        this.currentAuthPayload = authPayload;
        this.isAuthorized = false;
        this.authPromise = this.sendAuthRequest(authPayload);

        const response = await this.authPromise;
        if (!response || response.status !== 'ok' || !response.payload) {
            this.currentAuthPayload = null;
            this.authPromise = null;
            return response;
        }

        return response;
    }

    private async _askWrapper<T = unknown>(action: string, payload: Record<string, unknown>) {
        const res = await this._sendAndAwait<T>(action, payload);

        if (res.status === 'error') {
            throw new Error(res.payload.desc)
        }
        return res
    }

    public async ask<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<WsResponse<T>> {
        if (action === 'encrypt' || action === 'decrypt') {
            return this._askWrapper<T>(action, payload);
        }

        if (!this.authPromise) {
            if (this.currentAuthPayload) {
                await this.login(this.currentAuthPayload)
            }
            else {
                throw new Error('Call login once')
            }
        }
        const authResult = await this.authPromise;
        if (!authResult || !this.isAuthorized) {
            throw new Error('Cannot send request: Authentication failed or WebSocket is disconnected.');
        }

        return this._askWrapper<T>(action, payload);
    }
}