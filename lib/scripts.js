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

module.exports = { extractScripts };
