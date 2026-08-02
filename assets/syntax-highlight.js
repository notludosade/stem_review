(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.STEMSyntaxHighlight = api;
  if (typeof document !== 'undefined') api.attach(document.querySelectorAll('textarea.sandbox-editor'));
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const scan = (code, rules) => {
    const tokens = [];
    let pos = 0;
    let textStart = 0;
    while (pos < code.length) {
      let matched = null;
      for (const rule of rules) {
        rule.re.lastIndex = pos;
        const m = rule.re.exec(code);
        if (m && m.index === pos) { matched = { type: rule.type, text: m[0] }; break; }
      }
      if (matched) {
        if (pos > textStart) tokens.push({ type: 'text', text: code.slice(textStart, pos) });
        tokens.push(matched);
        pos += matched.text.length;
        textStart = pos;
      } else {
        pos += 1;
      }
    }
    if (code.length > textStart) tokens.push({ type: 'text', text: code.slice(textStart, code.length) });
    return tokens;
  };

  const RULES = {};

  const PYTHON_KEYWORDS = /\b(?:False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/g;
  RULES.python = [
    { type: 'comment', re: /#[^\n]*/g },
    { type: 'string', re: /'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g },
    { type: 'number', re: /\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/g },
    { type: 'keyword', re: PYTHON_KEYWORDS },
    { type: 'function', re: /[A-Za-z_]\w*(?=\s*\()/g },
  ];

  const JAVA_KEYWORDS = /\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|true|false|null)\b/g;
  RULES.java = [
    { type: 'comment', re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
    { type: 'string', re: /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g },
    { type: 'number', re: /\b\d+\.?\d*(?:[eE][+-]?\d+)?[fFdDlL]?\b/g },
    { type: 'keyword', re: JAVA_KEYWORDS },
    { type: 'function', re: /[A-Za-z_]\w*(?=\s*\()/g },
  ];

  const JAVASCRIPT_KEYWORDS = /\b(?:async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|finally|for|function|get|if|import|in|instanceof|let|new|of|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield|true|false|null|undefined)\b/g;
  RULES.javascript = [
    { type: 'comment', re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
    { type: 'string', re: /`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g },
    { type: 'number', re: /\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/g },
    { type: 'keyword', re: JAVASCRIPT_KEYWORDS },
    { type: 'function', re: /[A-Za-z_$]\w*(?=\s*\()/g },
  ];

  const tokenize = (code, language) => {
    const rules = RULES[language];
    if (!rules) return [{ type: 'text', text: code }];
    return scan(code, rules);
  };

  const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const render = (pre, code, language) => {
    const tokens = tokenize(code, language);
    const html = tokens.map((t) => t.type === 'text' ? escapeHtml(t.text) : `<span class="tok-${t.type}">${escapeHtml(t.text)}</span>`).join('');
    pre.innerHTML = html + '\n';
  };

  const attach = () => {};

  return { attach, tokenize, render, RULES };
}));
