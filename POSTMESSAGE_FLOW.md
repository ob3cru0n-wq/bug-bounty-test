# PostMessage Flow: portal.polygon.technology ↔ wallet.polygon.technology

## Overview

The communication between **portal.polygon.technology** (the DApp/Portal) and **wallet.polygon.technology** (the Sequence Ecosystem Wallet) uses the **window.postMessage** API via a popup window pattern. The Portal uses the **Sequence SDK's `DappTransport`** class, and the Wallet uses the **`WalletTransport`** (`lf` class in minified code) singleton.

Both sides share an identical protocol defined by the Sequence SDK.

---

## Protocol Constants

### MessageType Enum
```
WALLET_OPENED  — Wallet → DApp (broadcast on popup load)
INIT           — DApp → Wallet (handshake confirmation)
REQUEST        — DApp → Wallet (action request)
RESPONSE       — Wallet → DApp (action response)
```

### RequestActionType Enum (actions carried inside REQUEST messages)
```
createNewSession         — Create a new wallet session (connect wallet)
addExplicitSession       — Add an explicit session to an existing connection
modifyExplicitSession    — Modify an existing explicit session
signMessage              — Sign a message
signTypedData            — Sign EIP-712 typed data
sendWalletTransaction    — Send a transaction
```

### ConnectionState Enum
```
DISCONNECTED  — No connection
CONNECTING    — Popup opened, waiting for handshake
CONNECTED     — Handshake complete, ready for requests
```

### TransportMode Enum
```
popup     — Opens wallet as a popup window (default)
redirect  — Navigates to wallet URL, returns via redirect
```

---

## Message Shapes

### All messages share:
```json
{
  "id": "<unique-id>",       // Format: `${Date.now().toString(36)}-${Math.random().toString(36).substring(2,9)}`
  "type": "<MessageType>"    // One of: WALLET_OPENED, INIT, REQUEST, RESPONSE
}
```

### WALLET_OPENED (Wallet → DApp)
```json
{
  "id": "<generated-id>",
  "type": "WALLET_OPENED",
  "sessionId": "<session-id>"    // The sessionId from URL params or sessionStorage
}
```
**targetOrigin**: `"*"` (broadcast to any origin)

### INIT (DApp → Wallet)
```json
{
  "id": "<init-id>",            // The DApp's initId
  "type": "INIT",
  "sessionId": "<session-id>"   // Must match the sessionId the wallet reported
}
```
**targetOrigin**: `"https://wallet.polygon.technology"` (the walletOrigin)

### REQUEST (DApp → Wallet)
```json
{
  "id": "<request-id>",
  "type": "REQUEST",
  "action": "<RequestActionType>",  // e.g. "createNewSession"
  "payload": { ... }                // Action-specific payload
}
```
**targetOrigin**: `"https://wallet.polygon.technology"`

### RESPONSE (Wallet → DApp)
```json
{
  "id": "<request-id>",         // Matches the REQUEST id
  "type": "RESPONSE",
  "payload": { ... },           // Response data (present on success)
  "error": { ... }              // Error object (present on failure)
}
```
**targetOrigin**: `"<dappOrigin>"` (locked on first INIT message, e.g. `"https://portal.polygon.technology"`)

---

## Complete Flow: "Connect Wallet" Button Click

### Phase 1: Popup Open & Handshake

```
Portal (DApp)                                   Wallet (Popup)
─────────────                                   ──────────────

1. User clicks "Connect Wallet"
   │
   ├─ connectionState = CONNECTING
   ├─ Generate initId (unique ID)
   ├─ Generate sessionId (unique ID)
   ├─ Build URL: https://wallet.polygon.technology
   │   ?sessionId=<sessionId>
   ├─ window.open(url, "Wallet",
   │   "width=380,height=600,scrollbars=yes,resizable=yes")
   ├─ Start handshakeTimeout (15s)
   ├─ Start closeCheckInterval (500ms polling)
   ├─ window.addEventListener("message", handleMessage)
   │
   │                                            2. Wallet popup loads
   │                                               │
   │                                               ├─ Extract sessionId from URL params
   │                                               ├─ Store in sessionStorage["sequence.sessionId"]
   │                                               ├─ Set dappWindow = window.opener
   │                                               ├─ window.addEventListener("message", handleMessage)
   │                                               │
   │         ◄─── WALLET_OPENED ──────────────────┤
   │              { id, type: "WALLET_OPENED",     │
   │                sessionId: "<sessionId>" }     │
   │              targetOrigin: "*"                 │
   │                                               │
3. Portal receives WALLET_OPENED
   │ (origin check: e.origin === walletOrigin)
   │ (source check: e.source === walletWindow)
   │ (sessionId check: e.sessionId === this.sessionId)
   │
   ├─ Clear handshakeTimeout
   │
   ├──── INIT ────────────────────────────────────►│
   │     { id: initId, type: "INIT",               │
   │       sessionId: "<sessionId>" }               │
   │     targetOrigin: "https://wallet.polygon.technology"
   │                                               │
   ├─ connectionState = CONNECTED                  │
   ├─ Resolve readyPromise                         │
   ├─ Flush messageQueue                           │
   │                                               │
   │                                            4. Wallet receives INIT
   │                                               │
   │                                               ├─ Lock dappOrigin from e.origin
   │                                               │   → "https://portal.polygon.technology"
   │                                               │   Store in sessionStorage["sequence.dappOrigin"]
   │                                               ├─ isInitialized = true
   │                                               ├─ _isReady = true (if handlers registered)
   │                                               ├─ Process any pending incoming requests
   │                                               │
   ═══════════ HANDSHAKE COMPLETE ═════════════════╗
```

### Phase 2: Create New Session (Wallet Connection)

```
Portal (DApp)                                   Wallet (Popup)
─────────────                                   ──────────────

5. Portal sends createNewSession request
   │
   ├─ Generate request ID
   ├─ Build request:
   │   { id: "<req-id>",
   │     type: "REQUEST",
   │     action: "createNewSession",
   │     payload: {
   │       origin: "https://portal.polygon.technology",
   │       session: {
   │         sessionAddress: "<public-key>",  // Generated locally
   │         ...sessionConfig
   │       }
   │     }
   │   }
   ├─ Set timeout (300s / 5 minutes)
   ├─ Store in pendingRequests map
   │
   ├──── REQUEST (createNewSession) ──────────────►│
   │     targetOrigin: "https://wallet.polygon.technology"
   │                                               │
   │                                            6. Wallet receives REQUEST
   │                                               │ (origin check: e.origin === dappOrigin)
   │                                               │
   │                                               ├─ Lookup handler for "createNewSession"
   │                                               ├─ Show wallet UI:
   │                                               │   - Login screen (Google, Apple, Email, Passkey)
   │                                               │   - Or session approval if already logged in
   │                                               │
   │                                            7. User authenticates & approves
   │                                               │
   │                                               ├─ Create wallet session
   │                                               ├─ Generate ETHAuth proof
   │                                               ├─ Build response payload:
   │                                               │   { walletAddress: "0x...",
   │                                               │     loginMethod: "google"|"email"|...,
   │                                               │     userEmail: "...",
   │                                               │     ... }
   │                                               │
   │         ◄─── RESPONSE ───────────────────────┤
   │              { id: "<req-id>",                │
   │                type: "RESPONSE",              │
   │                payload: {                     │
   │                  walletAddress: "0x...",       │
   │                  ... session data             │
   │                } }                            │
   │              targetOrigin: "https://portal.polygon.technology"
   │                                               │
8. Portal receives RESPONSE
   ├─ Clear request timeout
   ├─ Remove from pendingRequests
   ├─ Resolve the Promise with payload
   ├─ Store session in IndexedDB / sessionStorage
   ├─ Update UI (wallet connected)
```

### Phase 3: Subsequent Requests (Sign/Send)

```
Portal (DApp)                                   Wallet (Popup)
─────────────                                   ──────────────

9. User initiates transaction (e.g. bridge)
   │
   ├──── REQUEST (signMessage) ───────────────────►│
   │     { id, type: "REQUEST",                    │
   │       action: "signMessage",                  │
   │       payload: { message: "..." } }           │
   │                                               │
   │                                            10. Wallet shows approval UI
   │                                               │
   │                                            11. User approves
   │                                               │
   │         ◄─── RESPONSE ───────────────────────┤
   │              { id, type: "RESPONSE",          │
   │                payload: {                     │
   │                  signature: "0x...",           │
   │                  walletAddress: "0x..."        │
   │                } }                            │
```

---

## Security Model

### Origin Validation

| Side | Validation | Detail |
|------|-----------|--------|
| **DApp (Portal)** | `e.origin !== walletOrigin` | Checks incoming messages come from `https://wallet.polygon.technology` |
| **DApp (Portal)** | `e.source !== walletWindow` | Checks message source is the popup it opened |
| **Wallet** | Locks `dappOrigin` on first INIT | Stores in `sessionStorage["sequence.dappOrigin"]` |
| **Wallet** | `e.origin !== dappOrigin` | Rejects messages from any other origin after lock |
| **Wallet** | `e.source !== window.opener` | Only accepts messages from the opener window |

### targetOrigin Usage

| Message | Sender | targetOrigin |
|---------|--------|-------------|
| `WALLET_OPENED` | Wallet | `"*"` (wildcard — any origin can receive) |
| `INIT` | DApp | `"https://wallet.polygon.technology"` (specific) |
| `REQUEST` | DApp | `"https://wallet.polygon.technology"` (specific) |
| `RESPONSE` | Wallet | `"https://portal.polygon.technology"` (locked dappOrigin) |

### Notable Security Observations

1. **WALLET_OPENED is sent with `targetOrigin: "*"`** — This is the only message sent to wildcard. It contains only the `sessionId` and message type, no sensitive data.

2. **Origin lock on first message** — The wallet locks the DApp origin on the *first* received message after popup opens. It stores this in `sessionStorage["sequence.dappOrigin"]`. Subsequent messages from different origins are rejected.

3. **Wallet refuses unsafe targetOrigin** — `postMessageToDapp()` checks: if `targetOrigin` is `null` or `"null"`, and it's not a `WALLET_OPENED` message with `"*"`, the wallet refuses to send.

4. **Session ID binding** — The DApp generates a `sessionId`, passes it as a URL parameter to the wallet popup, and verifies it in the `WALLET_OPENED` response. This prevents other popups from hijacking the connection.

5. **Close detection** — The DApp polls `walletWindow.closed` every 500ms and cleans up if the popup closes unexpectedly.

---

## Configuration (from Portal's Environment)

```
VITE_SEQUENCE_WALLET_URL = "https://wallet.polygon.technology"
VITE_SEQUENCE_ACCESS_KEY = "AQAAAAAAALxi7jXnN7StxHqDYMhubO9JOFE"
```

The `DappTransport` derives `walletOrigin` from the wallet URL:
```javascript
this.walletOrigin = new URL(walletUrl).origin
// → "https://wallet.polygon.technology"
```

---

## Storage Keys

| Key | Storage | Side | Purpose |
|-----|---------|------|---------|
| `sequence.dappOrigin` | sessionStorage | Wallet | Locked DApp origin |
| `sequence.sessionId` | sessionStorage | Wallet | Current session ID |
| `dapp-redirect-request` | sessionStorage | DApp | Pending redirect request |
| `SequenceImplicitSession` | IndexedDB | DApp | Implicit session data |
| `SequenceExplicitSessions` | IndexedDB | DApp | Explicit session data |
| `SequenceSessionlessConnection` | IndexedDB/localStorage | DApp | Sessionless connection state |

---

## Redirect Mode (Alternative Transport)

When popup mode fails (e.g. mobile browsers), the SDK falls back to redirect mode:

1. DApp navigates to: `https://wallet.polygon.technology/?mode=redirect&action=createNewSession&payload=<base64>&id=<id>&redirectUrl=<dapp-url>`
2. Wallet processes the request
3. Wallet redirects back to: `<redirectUrl>?id=<id>&payload=<base64-response>` (or `&error=<base64-error>`)

---

## Sequence Diagram (Compact)

```
    Portal                          Wallet Popup
    (DApp)                          (wallet.polygon.technology)
      │                                    │
      │──── window.open(walletUrl) ───────►│
      │     ?sessionId=abc123              │
      │                                    │
      │◄──── WALLET_OPENED ───────────────│  targetOrigin: "*"
      │      { sessionId: "abc123" }       │
      │                                    │
      │───── INIT ────────────────────────►│  targetOrigin: walletOrigin
      │      { sessionId: "abc123" }       │
      │                                    │  → locks dappOrigin
      │      ═══ CONNECTED ═══             │
      │                                    │
      │───── REQUEST ─────────────────────►│  targetOrigin: walletOrigin
      │      { action: "createNewSession", │
      │        payload: { origin, session }}│
      │                                    │  → User logs in / approves
      │◄──── RESPONSE ───────────────────│  targetOrigin: dappOrigin
      │      { payload: { walletAddress }} │
      │                                    │
      │───── REQUEST ─────────────────────►│  (subsequent actions)
      │      { action: "signMessage", ... }│
      │                                    │
      │◄──── RESPONSE ───────────────────│
      │      { payload: { signature } }    │
      │                                    │
```
