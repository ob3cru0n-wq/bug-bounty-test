(function() {
  'use strict';
  if (window.__pmSentinelInstalled) return;
  window.__pmSentinelInstalled = true;

  // ═══════════════════ SAVE ORIGINALS ═══════════════════
  const _etAEL = EventTarget.prototype.addEventListener;
  const _etREL = EventTarget.prototype.removeEventListener;
  const _windowPM = Window.prototype.postMessage;
  const _portPM = MessagePort.prototype.postMessage;
  const _bcPM = BroadcastChannel.prototype.postMessage;
  const _workerPM = Worker.prototype.postMessage;
  const _swPM = typeof ServiceWorker !== 'undefined' ? ServiceWorker.prototype.postMessage : null;
  const _BC = window.BroadcastChannel;
  const _MC = window.MessageChannel;
  const _Worker = window.Worker;
  const _SharedWorker = window.SharedWorker;
  const _fnToStr = Function.prototype.toString;
  const _setTimeout = window.setTimeout.bind(window);
  const _clearTimeout = window.clearTimeout.bind(window);

  let idCounter = 0;

  // ═══════════════════ SAFE SERIALIZATION ═══════════════════
  function safeSerialize(data, maxDepth, maxStr) {
    maxDepth = maxDepth || 6;
    maxStr = maxStr || 500;
    var seen = new WeakSet();

    function ser(val, depth) {
      if (depth > maxDepth) return '[…depth]';
      if (val === null) return null;
      if (val === undefined) return '[undefined]';

      var t = typeof val;
      if (t === 'boolean' || t === 'number') return val;
      if (t === 'bigint') return '[BigInt:' + val + ']';
      if (t === 'symbol') return '[Symbol:' + val.toString() + ']';
      if (t === 'function') return '[Function:' + (val.name || 'anon') + ']';
      if (t === 'string') return val.length > maxStr ? val.slice(0, maxStr) + '…[' + val.length + ']' : val;
      if (t !== 'object') return String(val);

      try { if (seen.has(val)) return '[Circular]'; seen.add(val); } catch(e) { return '[ref]'; }

      try {
        if (val instanceof Error) return '[' + (val.constructor.name || 'Error') + ':' + val.message + ']';
        if (val instanceof Date) return '[Date:' + val.toISOString() + ']';
        if (val instanceof RegExp) return '[RegExp:' + val.toString() + ']';
        if (val instanceof Map) {
          var entries = [];
          val.forEach(function(v, k) { if (entries.length < 10) entries.push([ser(k, depth+1), ser(v, depth+1)]); });
          return {__t: 'Map', size: val.size, entries: entries};
        }
        if (val instanceof Set) {
          var items = [];
          val.forEach(function(v) { if (items.length < 10) items.push(ser(v, depth+1)); });
          return {__t: 'Set', size: val.size, items: items};
        }
        if (val instanceof ArrayBuffer) return '[ArrayBuffer:' + val.byteLength + ']';
        if (ArrayBuffer.isView(val)) return '[' + val.constructor.name + ':' + val.length + ']';
        if (val instanceof Blob) return '[' + (val instanceof File ? 'File:' + val.name : 'Blob') + ':' + val.size + ':' + val.type + ']';
        if (val instanceof MessagePort) return '[MessagePort]';
        if (typeof DOMException !== 'undefined' && val instanceof DOMException) return '[DOMException:' + val.name + ']';
        if (typeof ImageData !== 'undefined' && val instanceof ImageData) return '[ImageData:' + val.width + 'x' + val.height + ']';
        if (val.nodeType) return '[DOM:' + val.nodeName + ']';

        if (Array.isArray(val)) {
          var arr = [];
          for (var i = 0; i < Math.min(val.length, 20); i++) arr.push(ser(val[i], depth+1));
          if (val.length > 20) arr.push('…' + val.length + ' total');
          return arr;
        }

        var obj = {};
        var keys;
        try { keys = Object.keys(val); } catch(e) { return '[keys-error]'; }
        for (var j = 0; j < Math.min(keys.length, 20); j++) {
          try { obj[keys[j]] = ser(val[keys[j]], depth+1); } catch(e) { obj[keys[j]] = '[getter-error]'; }
        }
        if (keys.length > 20) obj['…'] = keys.length + ' keys';
        return obj;
      } catch(e) {
        return '[serialize-error]';
      }
    }
    return ser(data, 0);
  }

  function safeToString(fn) {
    try { return _fnToStr.call(fn); } catch(e) { return String(fn); }
  }

  // ═══════════════════ STACK TRACE ═══════════════════
  function getStack(skip) {
    skip = skip || 3;
    try { throw new Error(); } catch(e) {
      var lines = (e.stack || '').split('\n').map(function(s) { return s.trim(); });
      return lines.slice(skip).filter(function(l) {
        return l && !/__pmSentinel/.test(l);
      });
    }
  }

  // ═══════════════════ TARGET IDENTIFICATION ═══════════════════
  function identifyTarget(target) {
    try {
      if (target === window) return 'Window';
      if (target === document) return 'Document';
      if (target instanceof MessagePort) return 'MessagePort';
      if (target instanceof _BC) return 'BroadcastChannel' + (target.name ? ':' + target.name : '');
      if (target instanceof _Worker) return 'Worker';
      if (target instanceof _SharedWorker) return 'SharedWorker';
      if (typeof ServiceWorker !== 'undefined' && target instanceof ServiceWorker) return 'ServiceWorker';
      if (typeof ServiceWorkerContainer !== 'undefined' && target instanceof ServiceWorkerContainer) return 'ServiceWorkerContainer';
      if (typeof WebSocket !== 'undefined' && target instanceof WebSocket) return 'WebSocket';
      if (typeof EventSource !== 'undefined' && target instanceof EventSource) return 'EventSource';
      if (target && target.constructor) return target.constructor.name || 'unknown';
    } catch(e) {}
    return 'unknown';
  }

  // ═══════════════════ REPORTING (batched) ═══════════════════
  var buffer = [];
  var flushTimer = null;

  function report(type, detail) {
    detail.type = type;
    detail.ts = Date.now();
    detail.id = ++idCounter;
    detail.domain = document.domain;
    detail.url = location.href;
    detail.frameInfo = window === top ? 'top' : (window.name || 'iframe');
    buffer.push(detail);
    if (buffer.length >= 50) flush();
    else if (!flushTimer) flushTimer = _setTimeout(flush, 30);
  }

  function flush() {
    if (flushTimer) { _clearTimeout(flushTimer); flushTimer = null; }
    if (!buffer.length) return;
    var batch = buffer.splice(0);
    try {
      document.dispatchEvent(new CustomEvent('__pmSentinel__', { detail: { batch: batch } }));
    } catch(e) {}
  }

  // ═══════════════════ HOOK HELPERS ═══════════════════
  function hideHook(hooked, original) {
    try {
      var origStr = _fnToStr.call(original);
      hooked.toString = function() { return origStr; };
      Object.defineProperty(hooked, 'length', { value: original.length, configurable: true });
      if (original.name) Object.defineProperty(hooked, 'name', { value: original.name, configurable: true });
    } catch(e) {}
  }

  // ═══════════════════ 1. addEventListener HOOK ═══════════════════
  var hookedAEL = function addEventListener(type, listener, options) {
    if (type === 'message' || type === 'messageerror') {
      report('listener:add', {
        target: identifyTarget(this),
        event: type,
        fn: typeof listener === 'function' ? safeToString(listener) : String(listener),
        capture: !!(options === true || (options && options.capture)),
        once: !!(options && options.once),
        stack: getStack()
      });
    }
    return _etAEL.call(this, type, listener, options);
  };
  hideHook(hookedAEL, _etAEL);
  EventTarget.prototype.addEventListener = hookedAEL;

  // ═══════════════════ 2. removeEventListener HOOK ═══════════════════
  var hookedREL = function removeEventListener(type, listener, options) {
    if (type === 'message' || type === 'messageerror') {
      report('listener:remove', {
        target: identifyTarget(this),
        event: type,
        fn: typeof listener === 'function' ? (listener.name || 'anon') : String(listener),
        stack: getStack()
      });
    }
    return _etREL.call(this, type, listener, options);
  };
  hideHook(hookedREL, _etREL);
  EventTarget.prototype.removeEventListener = hookedREL;

  // ═══════════════════ 3. onmessage SETTER HOOKS ═══════════════════
  function hookSetter(proto, prop, typeName) {
    var desc;
    try { desc = Object.getOwnPropertyDescriptor(proto, prop); } catch(e) { return; }
    if (!desc || !desc.set) return;
    var origSet = desc.set;
    var origGet = desc.get;
    try {
      Object.defineProperty(proto, prop, {
        get: origGet,
        set: function(fn) {
          report('listener:set', {
            target: typeName,
            event: prop === 'onmessage' ? 'message' : 'messageerror',
            fn: fn ? safeToString(fn) : null,
            stack: getStack()
          });
          return origSet.call(this, fn);
        },
        enumerable: desc.enumerable,
        configurable: true
      });
    } catch(e) {}
  }

  hookSetter(Window.prototype, 'onmessage', 'Window');
  hookSetter(MessagePort.prototype, 'onmessage', 'MessagePort');
  hookSetter(MessagePort.prototype, 'onmessageerror', 'MessagePort');
  hookSetter(BroadcastChannel.prototype, 'onmessage', 'BroadcastChannel');
  hookSetter(BroadcastChannel.prototype, 'onmessageerror', 'BroadcastChannel');
  hookSetter(Worker.prototype, 'onmessage', 'Worker');
  hookSetter(Worker.prototype, 'onmessageerror', 'Worker');
  if (typeof WebSocket !== 'undefined') hookSetter(WebSocket.prototype, 'onmessage', 'WebSocket');
  if (typeof EventSource !== 'undefined') hookSetter(EventSource.prototype, 'onmessage', 'EventSource');
  try {
    if (navigator.serviceWorker) {
      var swcProto = Object.getPrototypeOf(navigator.serviceWorker);
      if (swcProto) {
        hookSetter(swcProto, 'onmessage', 'ServiceWorkerContainer');
        hookSetter(swcProto, 'onmessageerror', 'ServiceWorkerContainer');
      }
    }
  } catch(e) {}

  // ═══════════════════ 4. postMessage HOOKS ═══════════════════
  // Window.postMessage(data, targetOrigin [, transfer])
  // Window.postMessage(data, options)   — options.targetOrigin, options.transfer
  var hookedWindowPM = function postMessage(data) {
    var targetOrigin = '*', transfer = null;
    if (arguments.length >= 2) {
      var arg1 = arguments[1];
      if (typeof arg1 === 'string') {
        targetOrigin = arg1;
        transfer = arguments[2] || null;
      } else if (arg1 && typeof arg1 === 'object') {
        targetOrigin = arg1.targetOrigin || '*';
        transfer = arg1.transfer || null;
      }
    }
    report('send:postMessage', {
      target: 'Window',
      data: safeSerialize(data),
      targetOrigin: targetOrigin,
      hasTransfer: !!(transfer && transfer.length),
      stack: getStack()
    });
    return _windowPM.apply(this, arguments);
  };
  hideHook(hookedWindowPM, _windowPM);
  Window.prototype.postMessage = hookedWindowPM;

  // MessagePort.postMessage(data [, transfer])
  var hookedPortPM = function postMessage(data) {
    report('send:postMessage', {
      target: 'MessagePort',
      data: safeSerialize(data),
      hasTransfer: !!(arguments[1] && arguments[1].length),
      stack: getStack()
    });
    return _portPM.apply(this, arguments);
  };
  hideHook(hookedPortPM, _portPM);
  MessagePort.prototype.postMessage = hookedPortPM;

  // BroadcastChannel.postMessage(data)
  var hookedBcPM = function postMessage(data) {
    report('send:postMessage', {
      target: 'BroadcastChannel' + (this.name ? ':' + this.name : ''),
      data: safeSerialize(data),
      stack: getStack()
    });
    return _bcPM.apply(this, arguments);
  };
  hideHook(hookedBcPM, _bcPM);
  BroadcastChannel.prototype.postMessage = hookedBcPM;

  // Worker.postMessage(data [, transfer])
  var hookedWorkerPM = function postMessage(data) {
    report('send:postMessage', {
      target: 'Worker',
      data: safeSerialize(data),
      hasTransfer: !!(arguments[1] && arguments[1].length),
      stack: getStack()
    });
    return _workerPM.apply(this, arguments);
  };
  hideHook(hookedWorkerPM, _workerPM);
  Worker.prototype.postMessage = hookedWorkerPM;

  // ServiceWorker.postMessage(data [, transfer])
  if (_swPM) {
    var hookedSwPM = function postMessage(data) {
      report('send:postMessage', {
        target: 'ServiceWorker',
        data: safeSerialize(data),
        hasTransfer: !!(arguments[1] && arguments[1].length),
        stack: getStack()
      });
      return _swPM.apply(this, arguments);
    };
    hideHook(hookedSwPM, _swPM);
    ServiceWorker.prototype.postMessage = hookedSwPM;
  }

  // ═══════════════════ 5. CONSTRUCTOR HOOKS ═══════════════════
  // BroadcastChannel
  window.BroadcastChannel = function BroadcastChannel(name) {
    report('channel:create', { channelType: 'BroadcastChannel', name: name });
    return new _BC(name);
  };
  window.BroadcastChannel.prototype = _BC.prototype;
  try { Object.setPrototypeOf(window.BroadcastChannel, _BC); } catch(e) {}

  // MessageChannel
  window.MessageChannel = function MessageChannel() {
    report('channel:create', { channelType: 'MessageChannel' });
    return new _MC();
  };
  window.MessageChannel.prototype = _MC.prototype;
  try { Object.setPrototypeOf(window.MessageChannel, _MC); } catch(e) {}

  // Worker
  window.Worker = function Worker(url, options) {
    report('channel:create', { channelType: 'Worker', workerUrl: String(url) });
    return options ? new _Worker(url, options) : new _Worker(url);
  };
  window.Worker.prototype = _Worker.prototype;
  try { Object.setPrototypeOf(window.Worker, _Worker); } catch(e) {}

  // SharedWorker
  if (_SharedWorker) {
    window.SharedWorker = function SharedWorker(url, options) {
      report('channel:create', { channelType: 'SharedWorker', workerUrl: String(url), name: typeof options === 'string' ? options : (options && options.name) });
      return typeof options !== 'undefined' ? new _SharedWorker(url, options) : new _SharedWorker(url);
    };
    window.SharedWorker.prototype = _SharedWorker.prototype;
    try { Object.setPrototypeOf(window.SharedWorker, _SharedWorker); } catch(e) {}
  }

  // ═══════════════════ 6. RECEIVE HOOK (passive listener) ═══════════════════
  _etAEL.call(window, 'message', function(evt) {
    report('receive:message', {
      origin: evt.origin,
      data: safeSerialize(evt.data),
      sourceType: evt.source === window ? 'self'
        : evt.source === window.parent ? 'parent'
        : evt.source === window.opener ? 'opener'
        : evt.source ? 'other-window' : 'null',
      ports: evt.ports ? evt.ports.length : 0
    });
  });

  // ═══════════════════ 7. HISTORY HOOKS ═══════════════════
  var _pushState = History.prototype.pushState;
  History.prototype.pushState = function() {
    report('nav:pushState', { url: arguments[2] ? String(arguments[2]) : '' });
    return _pushState.apply(this, arguments);
  };
  hideHook(History.prototype.pushState, _pushState);

  var _replaceState = History.prototype.replaceState;
  History.prototype.replaceState = function() {
    report('nav:replaceState', { url: arguments[2] ? String(arguments[2]) : '' });
    return _replaceState.apply(this, arguments);
  };
  hideHook(History.prototype.replaceState, _replaceState);

})();
