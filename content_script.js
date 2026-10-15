if (document.contentType !== 'application/xml' && !document.documentElement.dataset.pmSentinel) {
  document.documentElement.dataset.pmSentinel = '1';
  var s = document.createElement('script');
  s.src = (typeof browser !== 'undefined' ? browser : chrome).runtime.getURL('injected.js');
  s.type = 'text/javascript';
  document.documentElement.appendChild(s);
}

var runtime = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('__pmSentinel__', function(evt) {
  var batch = evt.detail && evt.detail.batch;
  if (!batch || !batch.length) return;
  try {
    runtime.runtime.sendMessage({ action: 'batch', events: batch });
  } catch(e) {}
});

window.addEventListener('beforeunload', function() {
  try {
    runtime.runtime.sendMessage({ action: 'page-unload' });
  } catch(e) {}
});
