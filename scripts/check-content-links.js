'use strict';

// Regression check for the Finding-1 class of bug: a content/*.html page
// references a local file that isn't actually servable at that URL.
//
// Next's catch-all route (pages/[[...slug]].tsx) only serves *.html files
// out of content/ — every other static asset (.js, .css, .md, images, …)
// must live under public/ to be served at all. A file swept into content/
// that isn't .html (e.g. a `git mv` that grabbed a whole directory) renders
// as a 404 with no build-time signal, because content/ files are read with
// fs.readFileSync rather than resolved through webpack.
//
// This walks every content/*.html page, extracts every local href/src, and
// asserts the resolved target exists in the root that actually serves it.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { listContentFiles } = require('../lib/content');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const PUBLIC_DIR = path.join(ROOT, 'public');

const REF_RE = /(?:href|src)\s*=\s*"([^"]*)"/g;
const SKIP_RE = /^(?:https?:|mailto:|tel:|data:|javascript:|#|\/\/)/i;

const files = listContentFiles(CONTENT_DIR);
let checked = 0;

for (const relFile of files) {
  const html = fs.readFileSync(path.join(CONTENT_DIR, relFile), 'utf8');
  const pageDir = path.posix.dirname(relFile); // '.' for top-level pages

  for (const match of html.matchAll(REF_RE)) {
    let target = match[1].trim();
    if (!target || SKIP_RE.test(target)) continue;
    target = target.split(/[?#]/)[0];
    if (!target) continue;
    target = decodeURIComponent(target);

    const urlPath = target.startsWith('/')
      ? target.slice(1)
      : path.posix.normalize(pageDir === '.' ? target : `${pageDir}/${target}`);

    assert.ok(
      !urlPath.startsWith('..'),
      `${relFile}: local reference "${match[1]}" escapes the site root (resolves to /${urlPath})`
    );

    if (urlPath.endsWith('.html')) {
      assert.ok(
        fs.existsSync(path.join(CONTENT_DIR, urlPath)),
        `${relFile}: broken reference "${match[1]}" — expected content/${urlPath} to exist`
      );
    } else {
      assert.ok(
        fs.existsSync(path.join(PUBLIC_DIR, urlPath)),
        `${relFile}: broken reference "${match[1]}" — non-.html targets are only servable from public/ ` +
          `(Next's catch-all route serves only *.html out of content/), expected public/${urlPath} to exist`
      );
    }
    checked += 1;
  }
}

console.log(`check-content-links: OK (${checked} local references across ${files.length} content pages)`);
