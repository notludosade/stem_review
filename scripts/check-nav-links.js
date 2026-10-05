'use strict';

// Every site link hard-coded in the shell nav must point at a real page —
// the dropdown lists are hand-maintained, so a renamed course or page would
// otherwise break the nav silently.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const layout = fs.readFileSync(path.join(root, 'components/Layout.tsx'), 'utf8');
const hrefs = [...layout.matchAll(/'(\/[^']*)'|href="(\/[^"]*)"/g)]
  .map((m) => m[1] || m[2])
  .filter((href) => !href.startsWith('/api/'));

assert.ok(hrefs.length > 80, `expected the nav to contain 80+ links, found ${hrefs.length}`);
for (const required of ['/about.html', '/pathways.html', '/problem-sets.html', '/sandbox.html']) {
  assert.ok(hrefs.includes(required), `nav is missing ${required}`);
}
assert.ok(!hrefs.includes('/dashboard.html'), 'nav still links /dashboard.html — the Dashboard is the homepage now');

hrefs.forEach((href) => {
  const pathname = decodeURIComponent(href.split(/[?#]/)[0]);
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const exists = fs.existsSync(path.join(root, 'content', rel)) || fs.existsSync(path.join(root, 'public', rel));
  assert.ok(exists, `nav link ${href} → ${rel} does not exist under content/ or public/`);
});

console.log(`check-nav-links: OK (${hrefs.length} nav links)`);
