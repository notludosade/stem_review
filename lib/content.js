const fs = require('fs');
const path = require('path');

function listContentFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(listContentFiles(fullPath, baseDir));
    } else if (entry.name.endsWith('.html')) {
      files.push(path.relative(baseDir, fullPath).split(path.sep).join('/'));
    }
  }
  return files;
}

function splitHtmlFragment(html) {
  const divIndex = html.indexOf('<div');
  const head = divIndex === -1 ? html : html.slice(0, divIndex);
  const body = divIndex === -1 ? html : html.slice(divIndex);
  const titleMatch = head.match(/<title>([\s\S]*?)<\/title>/);
  const title = titleMatch ? titleMatch[1] : 'STEM+';
  return { title, body };
}

module.exports = { splitHtmlFragment, listContentFiles };
