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

module.exports = { extractScripts, stripScripts };
