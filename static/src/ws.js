export class WsClient {
    wsUri;
    websocket;
    requests = new Map();
    reqId = 0;
    isAuthorized = false;
    authPromise = null;
    // Промис, который разрешается, когда сокет открылся (onopen)
    isReady = null;
    resolveReady = null;
    currentAuthPayload = null;

    constructor(urlPath) {
        this.wsUri = 'ws://' + window.location.host + urlPath;
        this.connect();
    }

    connect() {
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
                this.authPromise.then(() => {console.log('Authenticated')})
            }
        };

        this.websocket.onmessage = (event) => {
            const response = JSON.parse(event.data);
            const resolve = this.requests.get(response.rid);
            if (resolve) {
                console.debug(`Received: ${response.rid}`);
                resolve(response);
                this.requests.delete(response.rid);
            }
            else {
                console.warn(`No such rid: ${response.rid}, promises: ${this.requests}`);
            }
        };

        this.websocket.onclose = (event) => {
            console.warn(`WebSocket connection lost (code: ${event.code}). Reconnecting...`);
            this.isAuthorized = false;
            this.authPromise = null;
            this.isReady = new Promise((resolve) => {
                this.resolveReady = resolve;
            });
            this.requests.clear();
            setTimeout(() => this.connect(), 3000);
        };

        this.websocket.onerror = () => {
            this.websocket.close();
        };
    }
    async _sendAndAwait(action, payload = {}) {
        // Дожидаемся, пока сокет перейдет в состояние OPEN
        if (this.isReady) {
            await this.isReady;
        }

        // Проверяем статус на случай, если он успел закрыться
        if (this.websocket.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not in OPEN state.');
        }

        this.reqId++;
        const messageWithId = {
            action: action,
            payload: payload,
            rid: this.reqId
        };

        console.debug(`Send: ${this.reqId} ${action}`);

        return new Promise((resolve) => {
            this.requests.set(this.reqId, resolve);
            this.websocket.send(JSON.stringify(messageWithId));
        });
    }
    async sendAuthRequest(authPayload) {
        const response = await this._sendAndAwait('auth', authPayload);

        if (response && response.status === 'ok') {
            this.isAuthorized = true;
            return response;
        }

        this.isAuthorized = false;

        return response;
    }
    async login(username, password=null, token=null) {
        if (password === null && token === null) {
            throw new Error('Need to specify password or token')
        }

        const authPayload = {username, password, token}

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
    async _askWrapper(action, payload) {
        return await this._sendAndAwait(action, payload);
    }
    async ask(action, payload = {}) {
        if (action === 'encrypt' || action === 'decrypt') {
            return this._askWrapper(action, payload);
        }
        if (!this.authPromise) {
            if (this.currentAuthPayload) {
                await this.login(this.currentAuthPayload);
            }
            else {
                throw new Error('Call login once');
            }
        }
        const authResult = await this.authPromise;
        if (!authResult || !this.isAuthorized) {
            throw new Error('Cannot send request: Authentication failed or WebSocket is disconnected.');
        }
        return this._askWrapper(action, payload);
    }

    async encrypt_data(data) {
        return this._askWrapper('encrypt', {string: data})
    }

    async decrypt_data(data) {
        return this._askWrapper('decrypt', {string: data})
    }
}
