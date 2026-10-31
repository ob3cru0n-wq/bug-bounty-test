/**
 * Standalone Sequence Wallet postMessage handshake + createNewSession flow.
 *
 * Intended to run on https://teetettete.polygon.technology (or any origin).
 * The wallet locks dappOrigin from the browser-supplied event.origin of the
 * first message it receives after popup open.
 *
 * Usage:
 *   const client = new WalletConnector("https://wallet.polygon.technology");
 *   const session = await client.connect();
 *   console.log(session); // { walletAddress, ... }
 */

const WALLET_URL = "https://wallet.polygon.technology";

const MessageType = {
  WALLET_OPENED: "WALLET_OPENED",
  INIT: "INIT",
  REQUEST: "REQUEST",
  RESPONSE: "RESPONSE",
};

const RequestAction = {
  CREATE_NEW_SESSION: "createNewSession",
  SIGN_MESSAGE: "signMessage",
  SIGN_TYPED_DATA: "signTypedData",
  SEND_WALLET_TRANSACTION: "sendWalletTransaction",
};

function generateId() {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).substring(2, 9)
  );
}

class WalletConnector {
  constructor(walletUrl = WALLET_URL) {
    this.walletUrl = walletUrl;
    this.walletOrigin = new URL(walletUrl).origin;
    this.walletWindow = null;
    this.sessionId = null;
    this.initId = null;
    this.connected = false;
    this.pendingRequests = new Map();
    this._onMessage = this._onMessage.bind(this);
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.sessionId = generateId();
      this.initId = generateId();

      const url = new URL(this.walletUrl);
      url.searchParams.set("sessionId", this.sessionId);

      this.walletWindow = window.open(
        url.toString(),
        "Wallet",
        "width=380,height=600,scrollbars=yes,resizable=yes"
      );

      if (!this.walletWindow) {
        reject(new Error("Popup blocked. Allow popups and retry."));
        return;
      }

      this._connectResolve = resolve;
      this._connectReject = reject;

      window.addEventListener("message", this._onMessage);

      this._handshakeTimer = setTimeout(() => {
        this._cleanup();
        reject(new Error("Handshake timed out (15s)."));
      }, 15000);

      this._closePoller = setInterval(() => {
        if (this.walletWindow && this.walletWindow.closed) {
          this._cleanup();
          reject(new Error("Wallet popup closed before handshake."));
        }
      }, 500);
    });
  }

  sendRequest(action, payload = {}, timeoutMs = 300000) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error("Not connected. Call connect() first."));
        return;
      }

      const id = generateId();
      const msg = { id, type: MessageType.REQUEST, action, payload };

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${action} (${id}) timed out.`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.walletWindow.postMessage(msg, this.walletOrigin);
    });
  }

  async createNewSession(sessionConfig = {}) {
    const payload = {
      origin: window.location.origin,
      session: sessionConfig,
    };
    return this.sendRequest(RequestAction.CREATE_NEW_SESSION, payload);
  }

  async signMessage(message) {
    return this.sendRequest(RequestAction.SIGN_MESSAGE, { message });
  }

  async sendTransaction(transactionRequest, chainId) {
    return this.sendRequest(RequestAction.SEND_WALLET_TRANSACTION, {
      transactionRequest,
      chainId,
    });
  }

  close() {
    this._cleanup();
    if (this.walletWindow && !this.walletWindow.closed) {
      this.walletWindow.close();
    }
  }

  // ── internal ──

  _onMessage(event) {
    if (event.origin !== this.walletOrigin) return;
    if (event.source !== this.walletWindow) return;

    const data = event.data;
    if (!data || typeof data !== "object" || !data.id || !data.type) return;

    switch (data.type) {
      case MessageType.WALLET_OPENED:
        this._handleWalletOpened(data);
        break;
      case MessageType.RESPONSE:
        this._handleResponse(data);
        break;
    }
  }

  _handleWalletOpened(data) {
    if (this.connected) return;
    if (data.sessionId !== this.sessionId) return;

    clearTimeout(this._handshakeTimer);

    const initMsg = {
      id: this.initId,
      type: MessageType.INIT,
      sessionId: this.sessionId,
    };
    this.walletWindow.postMessage(initMsg, this.walletOrigin);

    this.connected = true;
    console.log(
      "[PoC] Handshake complete. Wallet locked dappOrigin to:",
      window.location.origin
    );

    if (this._connectResolve) {
      this._connectResolve({ connected: true, sessionId: this.sessionId });
      this._connectResolve = null;
      this._connectReject = null;
    }
  }

  _handleResponse(data) {
    const pending = this.pendingRequests.get(data.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(data.id);

    if (data.error) {
      pending.reject(new Error(JSON.stringify(data.error)));
    } else {
      pending.resolve(data.payload);
    }
  }

  _cleanup() {
    clearTimeout(this._handshakeTimer);
    clearInterval(this._closePoller);
    window.removeEventListener("message", this._onMessage);
    this.pendingRequests.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error("Connection closed."));
    });
    this.pendingRequests.clear();
    this.connected = false;
  }
}

// ── Quick-run helper ──
// Drop this into the browser console on teetettete.polygon.technology,
// or include as a <script> on that page.

async function run() {
  const client = new WalletConnector("https://wallet.polygon.technology");

  console.log("[PoC] Opening wallet popup and starting handshake...");
  const handshake = await client.connect();
  console.log("[PoC] Handshake result:", handshake);

  console.log("[PoC] Sending createNewSession request...");
  try {
    const session = await client.createNewSession();
    console.log("[PoC] Session created:", session);
  } catch (err) {
    console.error("[PoC] Session creation failed:", err.message);
  }

  return client;
}
