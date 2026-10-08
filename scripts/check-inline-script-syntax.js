'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { listContentFiles } = require('../lib/content');
const { extractScripts } = require('../lib/scripts');

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const files = listContentFiles(CONTENT_DIR);
let checked = 0;

for (const relFile of files) {
  const html = fs.readFileSync(path.join(CONTENT_DIR, relFile), 'utf8');
  for (const script of extractScripts(html)) {
    if (!script.content) continue; // external (src=) scripts have nothing to parse here
    try {
      // eslint-disable-next-line no-new-func
      new Function(script.content);
    } catch (err) {
      assert.fail(`${relFile}: inline <script> fails to parse as JavaScript — ${err.message}`);
    }
    checked += 1;
  }
}

console.log(`check-inline-script-syntax: OK (${checked} inline scripts across ${files.length} content pages parse cleanly)`);
