'use strict';

const assert = require('assert');
const { splitHtmlFragment } = require('../lib/content');
const { extractScripts } = require('../lib/scripts');

const { title, body } = splitHtmlFragment(
  '<meta charset="UTF-8">\n<title>Example — STEM+</title>\n<div class="page">\n  <h1>Example</h1>\n</div>\n'
);
assert.strictEqual(title, 'Example — STEM+', 'should extract the title text');
assert.ok(body.startsWith('<div class="page">'), 'body should start at the first <div');
assert.ok(!body.includes('<meta'), 'body should not include head tags');

const { title: fallbackTitle } = splitHtmlFragment('<div class="page"><h1>No title tag</h1></div>');
assert.strictEqual(fallbackTitle, 'STEM+', 'should fall back to STEM+ when no <title> tag is present');

const scripts = extractScripts(
  '<div class="page"><script src="assets/foo.js" defer></script><script>console.log("inline");</script></div>'
);
assert.strictEqual(scripts.length, 2, 'should find both script tags');
assert.strictEqual(scripts[0].src, 'assets/foo.js', 'first script should have the src attribute');
assert.strictEqual(scripts[0].content, null, 'external script should have no inline content');
assert.strictEqual(scripts[1].src, null, 'inline script should have no src');
assert.strictEqual(scripts[1].content, 'console.log("inline");', 'inline script content should be captured');

console.log('check-content: OK');
