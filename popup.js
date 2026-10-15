var runtime = typeof browser !== 'undefined' ? browser : chrome;
var currentTab = 'all';
var currentData = null;
var isPaused = false;

function $(id) { return document.getElementById(id); }

function fmtTime(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDetail(evt) {
  var lines = [];
  var skip = ['type', 'id', 'ts', 'domain', 'url', 'frameInfo', 'parentUrl'];
  Object.keys(evt).forEach(function(k) {
    if (skip.indexOf(k) >= 0) return;
    var v = evt[k];
    if (k === 'stack' && Array.isArray(v)) {
      lines.push('<span class="key">stack:</span>');
      v.slice(0, 8).forEach(function(frame) { lines.push('  ' + escHtml(frame)); });
      if (v.length > 8) lines.push('  …' + v.length + ' frames');
    } else if (k === 'data' && typeof v === 'object' && v !== null) {
      try { lines.push('<span class="key">data:</span> <span class="val">' + escHtml(JSON.stringify(v, null, 1)).slice(0, 800) + '</span>'); }
      catch(e) { lines.push('<span class="key">data:</span> <span class="val">[serialize error]</span>'); }
    } else if (k === 'fn') {
      var fnStr = String(v);
      if (fnStr.length > 400) fnStr = fnStr.slice(0, 400) + '…';
      lines.push('<span class="key">fn:</span> <span class="val">' + escHtml(fnStr) + '</span>');
    } else {
      lines.push('<span class="key">' + escHtml(k) + ':</span> <span class="val">' + escHtml(typeof v === 'object' ? JSON.stringify(v) : v) + '</span>');
    }
  });
  lines.push('<span class="key">url:</span> <span class="val">' + escHtml(evt.url || '') + '</span>');
  lines.push('<span class="key">frame:</span> <span class="val">' + escHtml(evt.frameInfo || '') + '</span>');
  return lines.join('\n');
}

function badgeClass(type) {
  if (type.startsWith('listener:')) return 'badge-listener';
  if (type.startsWith('send:')) return 'badge-send';
  if (type.startsWith('receive:')) return 'badge-receive';
  if (type.startsWith('channel:')) return 'badge-channel';
  if (type.startsWith('nav:')) return 'badge-nav';
  return 'badge-listener';
}

function summaryText(evt) {
  var t = evt.type || '';
  if (t === 'listener:add') return (evt.target || '?') + '.addEventListener(\'' + (evt.event || 'message') + '\')' + (evt.capture ? ' [capture]' : '') + (evt.once ? ' [once]' : '');
  if (t === 'listener:remove') return (evt.target || '?') + '.removeEventListener(\'' + (evt.event || 'message') + '\')';
  if (t === 'listener:set') return (evt.target || '?') + '.on' + (evt.event || 'message') + ' = ' + (evt.fn ? 'fn' : 'null');
  if (t === 'send:postMessage') {
    var s = (evt.target || '?') + '.postMessage(…)';
    if (evt.targetOrigin && evt.targetOrigin !== '*') s += ' origin=' + evt.targetOrigin;
    if (evt.hasTransfer) s += ' [transfer]';
    return s;
  }
  if (t === 'receive:message') return 'origin=' + (evt.origin || '*') + ' src=' + (evt.sourceType || '?') + (evt.ports > 0 ? ' ports=' + evt.ports : '');
  if (t === 'channel:create') return 'new ' + (evt.channelType || '?') + (evt.name ? '("' + evt.name + '")' : '') + (evt.workerUrl ? ' → ' + evt.workerUrl.slice(0, 60) : '');
  if (t.startsWith('nav:')) return t.split(':')[1] + ' → ' + (evt.url || '');
  return t;
}

function getCategory(type) {
  if (type.startsWith('listener:')) return 'listeners';
  if (type.startsWith('send:')) return 'sends';
  if (type.startsWith('receive:')) return 'receives';
  if (type.startsWith('channel:') || type.startsWith('nav:')) return 'channels';
  return 'all';
}

function renderEntries(data, filter) {
  var container = $('content');
  if (!data) { container.innerHTML = '<div class="empty">no data for this tab</div>'; return; }

  var all = [].concat(data.listeners || [], data.sends || [], data.receives || [], data.channels || [], data.nav || []);
  all.sort(function(a, b) { return (a.ts || 0) - (b.ts || 0); });

  if (currentTab !== 'all') {
    all = all.filter(function(e) { return getCategory(e.type) === currentTab; });
  }

  if (filter) {
    var fl = filter.toLowerCase();
    all = all.filter(function(e) {
      return (summaryText(e) + ' ' + (e.type || '') + ' ' + (e.target || '')).toLowerCase().indexOf(fl) >= 0;
    });
  }

  if (!all.length) { container.innerHTML = '<div class="empty">' + (currentTab === 'all' ? 'no events captured yet' : 'no ' + currentTab + ' events') + '</div>'; return; }

  var html = '';
  all.forEach(function(evt, i) {
    var badge = '<span class="badge ' + badgeClass(evt.type || '') + '">' + escHtml((evt.type || '').split(':')[0]) + '</span>';
    html += '<div class="entry" data-idx="' + i + '">'
      + '<div class="head">' + badge + ' <span class="summary">' + escHtml(summaryText(evt)) + '</span> <span class="time">' + fmtTime(evt.ts) + '</span></div>'
      + '<div class="detail" id="det-' + i + '">' + fmtDetail(evt) + '</div>'
      + '</div>';
  });
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;

  container.querySelectorAll('.entry').forEach(function(el) {
    el.addEventListener('click', function() {
      var det = el.querySelector('.detail');
      det.classList.toggle('open');
    });
  });
}

function updateStats(data) {
  var l = data ? (data.listeners || []).length : 0;
  var s = data ? (data.sends || []).length : 0;
  var r = data ? (data.receives || []).length : 0;
  var c = data ? (data.channels || []).length + (data.nav || []).length : 0;
  $('n-listeners').textContent = l;
  $('n-sends').textContent = s;
  $('n-receives').textContent = r;
  $('n-channels').textContent = c;
  $('n-all').textContent = l + s + r + c;
}

function refresh() {
  runtime.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0]) return;
    var tabId = tabs[0].id;
    runtime.runtime.sendMessage({ action: 'get-data', tabId: tabId }, function(resp) {
      if (runtime.runtime.lastError) return;
      currentData = resp && resp.data;
      isPaused = resp && resp.paused;
      $('btn-pause').textContent = isPaused ? '▶' : '⏸';
      $('btn-pause').classList.toggle('active', isPaused);
      updateStats(currentData);
      renderEntries(currentData, $('filter').value);
    });
  });
}

$('stats').addEventListener('click', function(e) {
  var stat = e.target.closest('.stat');
  if (!stat) return;
  document.querySelectorAll('.stat').forEach(function(s) { s.classList.remove('active'); });
  stat.classList.add('active');
  currentTab = stat.dataset.tab;
  renderEntries(currentData, $('filter').value);
});

$('btn-pause').addEventListener('click', function() {
  runtime.runtime.sendMessage({ action: 'set-pause', value: !isPaused }, function(resp) {
    isPaused = resp && resp.paused;
    $('btn-pause').textContent = isPaused ? '▶' : '⏸';
    $('btn-pause').classList.toggle('active', isPaused);
  });
});

$('btn-clear').addEventListener('click', function() {
  runtime.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0]) return;
    runtime.runtime.sendMessage({ action: 'clear-tab', tabId: tabs[0].id }, function() { refresh(); });
  });
});

$('btn-export').addEventListener('click', function() {
  runtime.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0]) return;
    runtime.runtime.sendMessage({ action: 'export-tab', tabId: tabs[0].id }, function(resp) {
      if (!resp || !resp.data) return;
      var blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'pm-sentinel-' + resp.tabId + '-' + Date.now() + '.json';
      a.click();
    });
  });
});

$('btn-options').addEventListener('click', function() {
  runtime.runtime.openOptionsPage();
});

$('filter').addEventListener('input', function() {
  renderEntries(currentData, this.value);
});

refresh();
setInterval(refresh, 1500);
