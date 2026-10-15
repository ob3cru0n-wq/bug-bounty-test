var runtime = typeof browser !== 'undefined' ? browser : chrome;

var fields = {
  'cap-listeners': { key: 'cap_listeners', type: 'checkbox', def: true },
  'cap-sends': { key: 'cap_sends', type: 'checkbox', def: true },
  'cap-receives': { key: 'cap_receives', type: 'checkbox', def: true },
  'cap-channels': { key: 'cap_channels', type: 'checkbox', def: true },
  'cap-nav': { key: 'cap_nav', type: 'checkbox', def: true },
  'max-events': { key: 'max_events', type: 'number', def: 5000 },
  'filter-ext': { key: 'filter_extensions', type: 'checkbox', def: true },
  'filter-devtools': { key: 'filter_devtools', type: 'checkbox', def: false },
  'exclude-sources': { key: 'exclude_sources', type: 'text', def: '' },
  'log-url': { key: 'log_url', type: 'text', def: '' }
};

function load() {
  var defaults = {};
  Object.keys(fields).forEach(function(id) { defaults[fields[id].key] = fields[id].def; });
  runtime.storage.sync.get(defaults, function(items) {
    Object.keys(fields).forEach(function(id) {
      var el = document.getElementById(id);
      var f = fields[id];
      if (f.type === 'checkbox') el.checked = items[f.key];
      else el.value = items[f.key];
    });
  });
}

function save() {
  var values = {};
  Object.keys(fields).forEach(function(id) {
    var el = document.getElementById(id);
    var f = fields[id];
    if (f.type === 'checkbox') values[f.key] = el.checked;
    else if (f.type === 'number') values[f.key] = parseInt(el.value) || f.def;
    else values[f.key] = el.value;
  });
  runtime.storage.sync.set(values, function() {
    var s = document.getElementById('saved');
    s.classList.add('show');
    setTimeout(function() { s.classList.remove('show'); }, 1500);
  });
}

document.getElementById('btn-save').addEventListener('click', save);
load();
