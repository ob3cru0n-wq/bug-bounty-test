// Paste this entire block into the browser DevTools console.
// Works on any origin — the wallet will lock dappOrigin to that origin.

(function () {
  var WALLET_URL = "https://wallet.polygon.technology";
  var walletOrigin = new URL(WALLET_URL).origin;
  var walletWindow = null;
  var sessionId = null;
  var initId = null;
  var connected = false;
  var pendingRequests = {};

  function genId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 9);
  }

  function log(tag, msg, data) {
    var style = tag === "SEND" ? "color:#f0f" : tag === "RECV" ? "color:#0f0" : tag === "ERR" ? "color:#f44" : "color:#0ff";
    if (data) console.log("%c[" + tag + "] " + msg, style, data);
    else console.log("%c[" + tag + "] " + msg, style);
  }

  function onMessage(e) {
    if (e.origin !== walletOrigin) return;
    if (e.source !== walletWindow) return;
    var d = e.data;
    if (!d || typeof d !== "object" || !d.id || !d.type) return;

    log("RECV", d.type, d);

    if (d.type === "WALLET_OPENED") {
      if (connected) return;
      if (d.sessionId !== sessionId) {
        log("ERR", "sessionId mismatch: got " + d.sessionId + ", expected " + sessionId);
        return;
      }
      var initMsg = { id: initId, type: "INIT", sessionId: sessionId };
      log("SEND", "INIT", initMsg);
      walletWindow.postMessage(initMsg, walletOrigin);
      connected = true;
      log("INFO", "Handshake complete. Wallet locked dappOrigin to: " + window.location.origin);
      log("INFO", "Now run:  createSession()");
    }

    if (d.type === "RESPONSE") {
      var p = pendingRequests[d.id];
      if (!p) return;
      clearTimeout(p.timer);
      delete pendingRequests[d.id];
      if (d.error) {
        log("ERR", "Response error", d.error);
        p.reject(d.error);
      } else {
        log("RECV", "Response payload", d.payload);
        p.resolve(d.payload);
      }
    }
  }

  // ── Step 1: Open wallet popup and handshake ──

  window.openWallet = function () {
    sessionId = genId();
    initId = genId();
    var url = WALLET_URL + "?sessionId=" + encodeURIComponent(sessionId);

    log("INFO", "Opening wallet popup...");
    log("INFO", "sessionId = " + sessionId);

    walletWindow = window.open(url, "Wallet", "width=380,height=600,scrollbars=yes,resizable=yes");
    if (!walletWindow) {
      log("ERR", "Popup blocked! Allow popups for this site and retry.");
      return;
    }

    window.addEventListener("message", onMessage);
    log("INFO", "Listening for WALLET_OPENED...");
  };

  // ── Generate a random Ethereum address (session key) ──

  function randomSessionAddress() {
    var bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    var hex = "0x";
    for (var i = 0; i < bytes.length; i++) {
      hex += ("0" + bytes[i].toString(16)).slice(-2);
    }
    return hex;
  }

  // ── Step 2: Send createNewSession after handshake ──

  window.createSession = function () {
    if (!connected) {
      log("ERR", "Not connected yet. Run openWallet() first and wait for handshake.");
      return;
    }
    var addr = randomSessionAddress();
    log("INFO", "Generated sessionAddress: " + addr);

    var id = genId();
    var msg = {
      id: id,
      type: "REQUEST",
      action: "createNewSession",
      payload: {
        origin: window.location.origin,
        session: {
          sessionAddress: addr
        }
      }
    };

    log("SEND", "REQUEST createNewSession", msg);
    walletWindow.postMessage(msg, walletOrigin);

    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        delete pendingRequests[id];
        log("ERR", "createNewSession timed out (5min)");
        reject(new Error("Timed out"));
      }, 300000);
      pendingRequests[id] = { resolve: resolve, reject: reject, timer: timer };
    });
  };

  // ── Step 3: Sign a message ──

  window.signMsg = function (message) {
    if (!connected) {
      log("ERR", "Not connected.");
      return;
    }
    var id = genId();
    var msg = {
      id: id,
      type: "REQUEST",
      action: "signMessage",
      payload: { message: message || "Hello from PoC" }
    };

    log("SEND", "REQUEST signMessage", msg);
    walletWindow.postMessage(msg, walletOrigin);

    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        delete pendingRequests[id];
        reject(new Error("Timed out"));
      }, 300000);
      pendingRequests[id] = { resolve: resolve, reject: reject, timer: timer };
    });
  };

  // ── Cleanup ──

  window.closeWallet = function () {
    window.removeEventListener("message", onMessage);
    if (walletWindow && !walletWindow.closed) walletWindow.close();
    connected = false;
    pendingRequests = {};
    log("INFO", "Wallet closed and cleaned up.");
  };

  log("INFO", "PoC loaded. Commands:");
  log("INFO", "  openWallet()      — open popup + handshake");
  log("INFO", "  createSession()   — send createNewSession request");
  log("INFO", "  signMsg('text')   — request message signature");
  log("INFO", "  closeWallet()     — close popup");
  log("INFO", "Current origin: " + window.location.origin);
})();
