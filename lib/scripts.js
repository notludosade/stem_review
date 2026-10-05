function extractScripts(html) {
  const scripts = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = scriptRe.exec(html)) !== null) {
    const attrs = match[1];
    const inner = match[2].trim();
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/);
    scripts.push({
      src: srcMatch ? srcMatch[1] : null,
      content: srcMatch ? null : inner || null,
    });
  }
  return scripts;
}

// The browser's native HTML parser executes <script> tags that are part of
// the initial server-rendered document — dangerouslySetInnerHTML only makes
// later React-driven updates to a node's content inert, not the very first
// parse of the page. Without this, every script extracted by extractScripts
// (for deliberate re-creation in LegacyContent) would ALSO fire once on its
// own via the raw markup left in `body`, double-executing everything.
function stripScripts(html) {
  return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, '');
}

// Legacy lessons register their inline setup with DOMContentLoaded because they
// were originally standalone documents. In the Next.js shell those scripts are
// inserted from a React effect, after DOMContentLoaded has already fired. Replay
// only listeners registered by the script being inserted instead of dispatching
// another document-wide DOMContentLoaded event (which would also wake Next/React
// listeners a second time).
function runWithDomReadyReplay(document, run) {
  if (document.readyState === 'loading') {
    run();
    return;
  }

  const originalAddEventListener = document.addEventListener;
  const readyListeners = [];
  document.addEventListener = function (type, listener, options) {
    if (type === 'DOMContentLoaded') {
      if (listener) readyListeners.push(listener);
      return;
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  try {
    run();
  } finally {
    document.addEventListener = originalAddEventListener;
  }

  if (readyListeners.length === 0) return;
  const EventConstructor = document.defaultView && document.defaultView.Event;
  const event = EventConstructor ? new EventConstructor('DOMContentLoaded') : { type: 'DOMContentLoaded' };
  readyListeners.forEach((listener) => {
    if (typeof listener === 'function') listener.call(document, event);
    else if (listener.handleEvent) listener.handleEvent(event);
  });
}

module.exports = { extractScripts, stripScripts, runWithDomReadyReplay };
