function splitHtmlFragment(html) {
  const divIndex = html.indexOf('<div');
  const head = divIndex === -1 ? html : html.slice(0, divIndex);
  const body = divIndex === -1 ? html : html.slice(divIndex);
  const titleMatch = head.match(/<title>([\s\S]*?)<\/title>/);
  const title = titleMatch ? titleMatch[1] : 'STEM+';
  return { title, body };
}

module.exports = { splitHtmlFragment };
