var runtime = typeof browser !== 'undefined' ? browser : chrome;

var tabStore = {};
var selectedTab = -1;
var paused = false;

function ensureTab(tabId) {
  if (!tabStore[tabId]) tabStore[tabId] = { listeners: [], sends: [], receives: [], channels: [], nav: [] };
  return tabStore[tabId];
}

function updateBadge(tabId) {
  var id = tabId || selectedTab;
  if (id < 0) return;
  var data = tabStore[id];
  var count = data ? data.listeners.length + data.sends.length + data.receives.length : 0;
  try {
    runtime.tabs.get(id, function() {
      if (runtime.runtime.lastError) return;
      runtime.action.setBadgeText({ text: count > 0 ? String(count) : '', tabId: id });
      runtime.action.setBadgeBackgroundColor({ tabId: id, color: count > 0 ? [0, 200, 200, 255] : [0, 0, 0, 0] });
    });
  } catch(e) {}
}

runtime.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (!sender.tab) {
    if (msg.action === 'get-data') {
      var tabId = msg.tabId || selectedTab;
      sendResponse({ data: tabStore[tabId] || null, tabId: tabId, paused: paused });
      return false;
    }
    if (msg.action === 'clear-tab') {
      var tid = msg.tabId || selectedTab;
      delete tabStore[tid];
      updateBadge(tid);
      sendResponse({ ok: true });
      return false;
    }
    if (msg.action === 'clear-all') {
      tabStore = {};
      sendResponse({ ok: true });
      return false;
    }
    if (msg.action === 'set-pause') {
      paused = !!msg.value;
      sendResponse({ paused: paused });
      return false;
    }
    if (msg.action === 'export-tab') {
      var eid = msg.tabId || selectedTab;
      sendResponse({ data: tabStore[eid] || null, tabId: eid });
      return false;
    }
    return false;
  }

  if (paused) return false;

  var tabId = sender.tab.id;
  if (!tabId) return false;

  if (msg.action === 'batch' && msg.events) {
    var store = ensureTab(tabId);
    var maxPerCategory = 5000;

    msg.events.forEach(function(evt) {
      evt.parentUrl = sender.tab.url;
      var t = evt.type || '';

      if (t.startsWith('listener:')) {
        store.listeners.push(evt);
        if (store.listeners.length > maxPerCategory) store.listeners.splice(0, 500);
      } else if (t.startsWith('send:')) {
        store.sends.push(evt);
        if (store.sends.length > maxPerCategory) store.sends.splice(0, 500);
      } else if (t.startsWith('receive:')) {
        store.receives.push(evt);
        if (store.receives.length > maxPerCategory) store.receives.splice(0, 500);
      } else if (t.startsWith('channel:')) {
        store.channels.push(evt);
      } else if (t.startsWith('nav:')) {
        store.nav.push(evt);
      }
    });
    updateBadge(tabId);
  }

  if (msg.action === 'page-unload') {
    delete tabStore[tabId];
    updateBadge(tabId);
  }

  return false;
});

runtime.tabs.onUpdated.addListener(function(tabId, changeInfo) {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    delete tabStore[tabId];
    updateBadge(tabId);
  }
  if (changeInfo.status === 'complete' && tabId === selectedTab) {
    updateBadge(tabId);
  }
});

runtime.tabs.onActivated.addListener(function(info) {
  selectedTab = info.tabId;
  updateBadge(info.tabId);
});

runtime.tabs.onRemoved.addListener(function(tabId) {
  delete tabStore[tabId];
});

runtime.runtime.onStartup.addListener(function() {
  runtime.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs && tabs[0]) {
      selectedTab = tabs[0].id;
      updateBadge(selectedTab);
    }
  });
});
