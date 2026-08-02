# Sandbox Editor Highlighting + Backspace-Dedent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real syntax highlighting (Python/Java/JavaScript/C++) and soft-tab backspace-dedent to STEM+'s shared code sandbox editor, without touching its existing tested Tab/Enter/bracket-pairing behavior.

**Architecture:** `assets/code-editor.js` gains one new pure function (`backspace`) wired into its existing `keydown` dispatcher. A new `assets/syntax-highlight.js` adds a linear regex-driven tokenizer per language and a thin DOM layer that overlays a `<pre><code>`-style highlighted mirror behind each `<textarea class="sandbox-editor">`, kept in sync on `input`/`scroll`. New CSS in `assets/style.css` positions the overlay (CSS Grid stacking, so native textarea resize keeps working) and colors the token types.

**Tech Stack:** Plain vanilla JS, plain CSS. No build step, no new dependency, no CDN.

## Global Constraints

- No editor library (CodeMirror/Ace/etc.) — the native textarea and all of `code-editor.js`'s existing Tab/Enter/bracket-pairing logic stay untouched.
- No CDN, no new npm/runtime dependency.
- Tokenizers are pure functions (`tokenize(code, language)` → array of `{ type, text }`), independently testable without a browser, following the exact pattern already used in `scripts/check-code-editor.js`.
- Backspace only intercepts when the selection is collapsed and everything from line-start to the cursor is spaces; every other case (mid-word, after non-whitespace, empty prefix) must leave the textarea's value/selection untouched so the browser's native default behavior applies.
- Token colors must not collide with `--correct`/`--incorrect` (site's semantic pass/fail colors, `assets/style.css:10-13`) or the Sandbox category's `--accent` (`#5f7a2a`/`#a8c96a`) — all of these can appear on the same sandbox pages as highlighted code.
- No visual/browser verification is possible in this environment (no display, no headless browser) — every task's testing is headless logic testing; the final rendered result needs the user's own look in a real browser.

---

### Task 1: Backspace-dedent

**Files:**
- Modify: `assets/code-editor.js` (add `backspace()`, wire into `keydown()`)
- Modify: `scripts/check-code-editor.js` (add test cases)

**Interfaces:**
- Produces: `backspace(editor)` — returns `true` and deletes back to the previous indent stop if the selection is collapsed and the line-start-to-cursor text is all spaces; returns `false` (no changes) otherwise. Wired into the existing `keydown(editor, event)` so `event.key === 'Backspace'` calls it and `preventDefault()`s only when it returns `true`.

- [ ] **Step 1: Add the `backspace` function**

In `assets/code-editor.js`, add this function after the existing `close` function (after line 66, before the `keydown` function):

```js
  const backspace = (editor) => {
    const { value, selectionStart: start, selectionEnd: end } = editor;
    if (start !== end) return false;
    const first = lineStart(value, start);
    const before = value.slice(first, start);
    if (before.length === 0 || !/^ *$/.test(before)) return false;
    const size = indentSize(editor);
    const remove = ((before.length - 1) % size) + 1;
    change(editor, start - remove, start, '', start - remove);
    return true;
  };
```

- [ ] **Step 2: Wire it into `keydown`**

Replace:

```js
  const keydown = (editor, event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      tab(editor, event.shiftKey);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      enter(editor);
    } else if ('}])'.includes(event.key) && close(editor, event.key)) event.preventDefault();
  };
```

with:

```js
  const keydown = (editor, event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      tab(editor, event.shiftKey);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      enter(editor);
    } else if (event.key === 'Backspace' && backspace(editor)) {
      event.preventDefault();
    } else if ('}])'.includes(event.key) && close(editor, event.key)) event.preventDefault();
  };
```

- [ ] **Step 3: Add test cases**

In `scripts/check-code-editor.js`, insert before the final `console.log('Code editor audit passed...')` line:

```js
target = editor('    return 1;', 6, 6, 4);
press(target, 'Backspace');
assert(target.value === '  return 1;' && target.selectionStart === 2, 'Backspace should snap to the previous indent stop');

target = editor('    x', 4, 4, 4);
press(target, 'Backspace');
assert(target.value === 'x' && target.selectionStart === 0, 'Backspace at an exact indent stop should remove a full indent unit');

target = editor('  return 1;', 2, 2, 4);
press(target, 'Backspace');
assert(target.value === 'return 1;' && target.selectionStart === 0, 'Backspace with less than one indent unit of whitespace should remove all of it');

target = editor('return 1;', 3, 3, 4);
press(target, 'Backspace');
assert(target.value === 'return 1;' && target.selectionStart === 3, 'Backspace after non-whitespace should not be intercepted, leaving native default behavior to apply');
```

Update the final line's message to also mention backspace:

```js
console.log('Code editor audit passed: Tab, Shift+Tab, selections, auto-indent, brace pairs, smart outdent, and backspace-dedent.');
```

- [ ] **Step 4: Run the test**

```bash
node scripts/check-code-editor.js
```

Expected: `Code editor audit passed: Tab, Shift+Tab, selections, auto-indent, brace pairs, smart outdent, and backspace-dedent.`

- [ ] **Step 5: Commit**

```bash
git add assets/code-editor.js scripts/check-code-editor.js
git commit -m "Add backspace-dedent to the sandbox code editor"
```

---

### Task 2: Shared tokenizer scanner + render + Python grammar

**Files:**
- Create: `assets/syntax-highlight.js`
- Create: `scripts/check-syntax-highlight.js`

**Interfaces:**
- Produces: `assets/syntax-highlight.js` exports `{ attach, tokenize, render }`. `tokenize(code, language) -> Array<{type: 'keyword'|'string'|'comment'|'number'|'function'|'text', text: string}>`. `render(pre, code, language)` sets `pre.innerHTML` to the HTML-escaped, token-wrapped markup (each non-`text` token wrapped in `<span class="tok-{type}">`). `attach(editors)` is the DOM-wiring entry point (built in Task 6 — this task creates the function name/export as a no-op-safe stub so later tasks can extend it without changing the module's public shape; see Step 1).
- Consumes: nothing.

- [ ] **Step 1: Write the module skeleton, shared scanner, and render/escapeHtml**

```js
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
```

Note: `RULES` is exported so later tasks can add language grammars to it from within the same IIFE (each task's Step 1 adds `RULES.python = [...]` etc. inside the factory function, before the `return` statement — see Task 2 Step 2 below for the pattern; Tasks 3-5 follow the same pattern for their languages). `attach` is a no-op here; Task 6 replaces it with the real DOM-wiring implementation.

- [ ] **Step 2: Add the Python grammar**

Insert this before the `const tokenize = ...` line (so `RULES.python` exists when `tokenize`/`attach` reference `RULES`):

```js
  const PYTHON_KEYWORDS = /\b(?:False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/g;
  RULES.python = [
    { type: 'comment', re: /#[^\n]*/g },
    { type: 'string', re: /'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g },
    { type: 'number', re: /\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/g },
    { type: 'keyword', re: PYTHON_KEYWORDS },
    { type: 'function', re: /[A-Za-z_]\w*(?=\s*\()/g },
  ];
```

- [ ] **Step 3: Write the test file**

```js
'use strict';

const { tokenize, render } = require('../assets/syntax-highlight.js');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const types = (code, lang) => tokenize(code, lang).filter((t) => t.type !== 'text').map((t) => `${t.type}:${t.text}`);

// Python
let found = types('def add(a, b):\n    return a + b  # sum\n', 'python');
assert(found.includes('keyword:def'), 'Python keyword not detected');
assert(found.includes('function:add'), 'Python function-call name not detected');
assert(found.includes('comment:# sum'), 'Python comment not detected');

found = types('name = "hi"\ncount = 3.5\n', 'python');
assert(found.includes('string:"hi"'), 'Python string not detected');
assert(found.includes('number:3.5'), 'Python number not detected');

found = types('doc = """line one\nline two"""\n', 'python');
assert(found.some((t) => t.startsWith('string:') && t.includes('line one') && t.includes('line two')), 'Python multi-line string not detected');

// render()
const fakePre = { innerHTML: '' };
render(fakePre, 'def f():', 'python');
assert(fakePre.innerHTML.includes('<span class="tok-keyword">def</span>'), 'render() should wrap keyword tokens in a tok-keyword span');
assert(fakePre.innerHTML.includes('<span class="tok-function">f</span>'), 'render() should wrap function-call tokens in a tok-function span');

console.log('check-syntax-highlight: Python OK');
```

- [ ] **Step 4: Run the test**

```bash
node scripts/check-syntax-highlight.js
```

Expected: `check-syntax-highlight: Python OK`

- [ ] **Step 5: Commit**

```bash
git add assets/syntax-highlight.js scripts/check-syntax-highlight.js
git commit -m "Add syntax-highlight scanner, render, and Python grammar"
```

---

### Task 3: Java grammar

**Files:**
- Modify: `assets/syntax-highlight.js` (add `RULES.java`)
- Modify: `scripts/check-syntax-highlight.js` (add Java tests)

**Interfaces:**
- Consumes: `scan`, `RULES` from Task 2 (same file, same module).
- Produces: `RULES.java`, exercised via the existing `tokenize(code, 'java')`.

- [ ] **Step 1: Add the Java grammar**

In `assets/syntax-highlight.js`, add after the `RULES.python = [...]` block:

```js
  const JAVA_KEYWORDS = /\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|true|false|null)\b/g;
  RULES.java = [
    { type: 'comment', re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
    { type: 'string', re: /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g },
    { type: 'number', re: /\b\d+\.?\d*(?:[eE][+-]?\d+)?[fFdDlL]?\b/g },
    { type: 'keyword', re: JAVA_KEYWORDS },
    { type: 'function', re: /[A-Za-z_]\w*(?=\s*\()/g },
  ];
```

- [ ] **Step 2: Add tests**

In `scripts/check-syntax-highlight.js`, insert before the `// render()` section:

```js
// Java
found = types('public class Main {\n  // entry\n  public static void main(String[] args) {\n    System.out.println("hi");\n  }\n}\n', 'java');
assert(found.includes('keyword:public'), 'Java keyword not detected');
assert(found.includes('comment:// entry'), 'Java line comment not detected');
assert(found.includes('function:println'), 'Java function-call name not detected');
assert(found.includes('string:"hi"'), 'Java string not detected');

found = types('/* block\ncomment */\nint x = 5;\n', 'java');
assert(found.some((t) => t.startsWith('comment:') && t.includes('block') && t.includes('comment')), 'Java multi-line comment not detected');
```

Update the final `console.log` line to:

```js
console.log('check-syntax-highlight: Python, Java OK');
```

- [ ] **Step 3: Run the test**

```bash
node scripts/check-syntax-highlight.js
```

Expected: `check-syntax-highlight: Python, Java OK`

- [ ] **Step 4: Commit**

```bash
git add assets/syntax-highlight.js scripts/check-syntax-highlight.js
git commit -m "Add Java grammar to syntax-highlight"
```

---

### Task 4: JavaScript grammar

**Files:**
- Modify: `assets/syntax-highlight.js` (add `RULES.javascript`)
- Modify: `scripts/check-syntax-highlight.js` (add JavaScript tests)

**Interfaces:**
- Consumes: `scan`, `RULES` from Task 2 (same file, same module).
- Produces: `RULES.javascript`, exercised via `tokenize(code, 'javascript')`.

- [ ] **Step 1: Add the JavaScript grammar**

In `assets/syntax-highlight.js`, add after the `RULES.java = [...]` block:

```js
  const JAVASCRIPT_KEYWORDS = /\b(?:async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|finally|for|function|get|if|import|in|instanceof|let|new|of|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield|true|false|null|undefined)\b/g;
  RULES.javascript = [
    { type: 'comment', re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
    { type: 'string', re: /`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g },
    { type: 'number', re: /\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/g },
    { type: 'keyword', re: JAVASCRIPT_KEYWORDS },
    { type: 'function', re: /[A-Za-z_$]\w*(?=\s*\()/g },
  ];
```

- [ ] **Step 2: Add tests**

In `scripts/check-syntax-highlight.js`, insert before the `// render()` section:

```js
// JavaScript
found = types('function add(a, b) {\n  return a + b; // sum\n}\n', 'javascript');
assert(found.includes('keyword:function'), 'JavaScript keyword not detected');
assert(found.includes('function:add'), 'JavaScript function-call name not detected');
assert(found.includes('comment:// sum'), 'JavaScript comment not detected');

found = types('const msg = `hi ${1}`;\n', 'javascript');
assert(found.some((t) => t.startsWith('string:') && t.includes('hi')), 'JavaScript template string not detected');
```

Update the final `console.log` line to:

```js
console.log('check-syntax-highlight: Python, Java, JavaScript OK');
```

- [ ] **Step 3: Run the test**

```bash
node scripts/check-syntax-highlight.js
```

Expected: `check-syntax-highlight: Python, Java, JavaScript OK`

- [ ] **Step 4: Commit**

```bash
git add assets/syntax-highlight.js scripts/check-syntax-highlight.js
git commit -m "Add JavaScript grammar to syntax-highlight"
```

---

### Task 5: C++ grammar

**Files:**
- Modify: `assets/syntax-highlight.js` (add `RULES.cpp`)
- Modify: `scripts/check-syntax-highlight.js` (add C++ tests)

**Interfaces:**
- Consumes: `scan`, `RULES` from Task 2 (same file, same module).
- Produces: `RULES.cpp`, exercised via `tokenize(code, 'cpp')`.

- [ ] **Step 1: Add the C++ grammar**

In `assets/syntax-highlight.js`, add after the `RULES.javascript = [...]` block:

```js
  const CPP_KEYWORDS = /\b(?:alignas|alignof|auto|bool|break|case|catch|char|class|const|constexpr|continue|default|delete|do|double|else|enum|explicit|export|extern|false|float|for|friend|if|inline|int|long|mutable|namespace|new|noexcept|nullptr|operator|private|protected|public|return|short|signed|sizeof|static|struct|switch|template|this|throw|true|try|typedef|typename|union|unsigned|using|virtual|void|volatile|while)\b/g;
  RULES.cpp = [
    { type: 'comment', re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
    { type: 'string', re: /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g },
    { type: 'keyword', re: /#\s*\w+/g },
    { type: 'number', re: /\b\d+\.?\d*(?:[eE][+-]?\d+)?[fFlLuU]*\b/g },
    { type: 'keyword', re: CPP_KEYWORDS },
    { type: 'function', re: /[A-Za-z_]\w*(?=\s*\()/g },
  ];
```

- [ ] **Step 2: Add tests**

In `scripts/check-syntax-highlight.js`, insert before the `// render()` section:

```js
// C++
found = types('#include <iostream>\nint main() {\n  std::cout << "hi"; // print\n}\n', 'cpp');
assert(found.includes('keyword:#include'), 'C++ preprocessor directive not detected');
assert(found.includes('keyword:int'), 'C++ keyword not detected');
assert(found.includes('function:main'), 'C++ function-call name not detected');
assert(found.includes('comment:// print'), 'C++ comment not detected');
assert(found.includes('string:"hi"'), 'C++ string not detected');
```

Update the final `console.log` line to:

```js
console.log('check-syntax-highlight: Python, Java, JavaScript, C++ OK');
```

- [ ] **Step 3: Run the test**

```bash
node scripts/check-syntax-highlight.js
```

Expected: `check-syntax-highlight: Python, Java, JavaScript, C++ OK`

- [ ] **Step 4: Commit**

```bash
git add assets/syntax-highlight.js scripts/check-syntax-highlight.js
git commit -m "Add C++ grammar to syntax-highlight"
```

---

### Task 6: DOM wiring + CSS

**Files:**
- Modify: `assets/syntax-highlight.js` (replace the `attach` stub with the real implementation)
- Modify: `assets/style.css` (overlay positioning + token colors)

**Interfaces:**
- Consumes: `render`, `tokenize` from Tasks 2-5 (same file). Also consumes the static markup Task 7 adds: `attach` does NOT create the `.sandbox-editor-wrap` container itself — Task 7's HTML already wraps every `<textarea class="sandbox-editor">` in one (with `data-language` on it, or on an ancestor for the one dynamic-language page). `attach` only finds that existing wrapper and inserts the `<pre class="sandbox-editor-highlight">` overlay into it. This ordering matters: if `attach` also built its own wrapper, a page with Task 7's static wrapper already in place would end up double-wrapped. An editor with no `.sandbox-editor-wrap` ancestor (none should exist after Task 7, but the check is cheap insurance) is left alone — no highlighting, no error.
- Produces: `attach(editors)` — for each editor whose `.sandbox-editor-wrap` doesn't already contain a `.sandbox-editor-highlight`, inserts one, wires `input`/`scroll` listeners to keep it in sync, and reads the language fresh on every render via `editor.closest('[data-language]')?.dataset.language` (not cached at attach time, so the page that sets `data-language` dynamically after attach — Task 7's `guided-language-project.html` — still highlights correctly once the user starts typing, since typing happens well after page setup).

There is no headless test for this task — it requires real DOM APIs (`document.createElement`, `closest`, layout/scroll) that the project's Node-based test harness doesn't provide. Verify by careful code reading against the Interfaces above; this is consistent with how the DOM-wiring parts of `code-editor.js` (`attach`) have never had their own test either — only the pure logic functions are tested.

- [ ] **Step 1: Replace the `attach` stub**

Replace:

```js
  const attach = () => {};
```

with:

```js
  const attachOne = (editor) => {
    const wrap = editor.closest('.sandbox-editor-wrap');
    if (!wrap || wrap.querySelector('.sandbox-editor-highlight')) return;
    const pre = document.createElement('pre');
    pre.className = 'sandbox-editor-highlight';
    pre.setAttribute('aria-hidden', 'true');
    wrap.insertBefore(pre, editor);

    const language = () => editor.closest('[data-language]')?.dataset.language;
    const update = () => render(pre, editor.value, language());
    editor.addEventListener('input', update);
    editor.addEventListener('scroll', () => {
      pre.scrollTop = editor.scrollTop;
      pre.scrollLeft = editor.scrollLeft;
    });
    update();
  };

  const attach = (editors) => editors.forEach(attachOne);
```

Note the `wrap.insertBefore(pre, editor)` ordering: the `<pre>` lands immediately before the textarea in the wrapper's DOM order. With the CSS Grid stacking from Step 3 below (both children on `grid-area: 1 / 1`), later-in-DOM paints on top by default — so the textarea (interactive, transparent text, visible caret) stays on top and the `<pre>` (highlighted, `pointer-events: none`) stays visually behind it, without needing an explicit `z-index`.

- [ ] **Step 2: Verify the syntax and that existing tests still pass**

```bash
node --check assets/syntax-highlight.js
node scripts/check-syntax-highlight.js
```

Expected: no syntax errors; `check-syntax-highlight: Python, Java, JavaScript, C++ OK` (this task doesn't touch `tokenize`/`render`, so the existing tests must still pass unchanged — a real regression check, not just a formality).

- [ ] **Step 3: Add the CSS**

In `assets/style.css`, immediately after the existing `.sandbox-editor:focus { outline: 2px solid var(--accent); outline-offset: 1px; }` line (currently line 447) and before `.sandbox-editor-free { min-height: 22rem; }`, replace that whole block:

Replace:

```css
.sandbox-editor {
  display: block;
  width: 100%;
  min-height: 18rem;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.85rem 1rem;
  background: var(--code-bg);
  color: var(--text);
  font: 0.9rem/1.55 "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  tab-size: 4;
}
.sandbox-editor:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
.sandbox-editor-free { min-height: 22rem; }
```

with:

```css
.sandbox-editor-wrap {
  display: grid;
  position: relative;
}
.sandbox-editor-wrap > .sandbox-editor,
.sandbox-editor-wrap > .sandbox-editor-highlight {
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  margin: 0;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.85rem 1rem;
  font: 0.9rem/1.55 "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  tab-size: 4;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.sandbox-editor-wrap > .sandbox-editor {
  display: block;
  min-height: 18rem;
  resize: vertical;
  overflow: auto;
  background: transparent;
  color: transparent;
  caret-color: var(--text);
}
.sandbox-editor-wrap > .sandbox-editor:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
.sandbox-editor-wrap > .sandbox-editor.sandbox-editor-free { min-height: 22rem; }
.sandbox-editor-wrap > .sandbox-editor-highlight {
  overflow: hidden;
  pointer-events: none;
  background: var(--code-bg);
  color: var(--text);
  border-color: transparent;
}
.tok-keyword { color: #3a4fa0; font-weight: 600; }
.tok-string { color: #0f6e7a; }
.tok-comment { color: var(--muted); font-style: italic; }
.tok-number { color: #8a3d8a; }
.tok-function { color: #9c5a1f; }
@media (prefers-color-scheme: dark) {
  .tok-keyword { color: #9aa8e8; }
  .tok-string { color: #6fc9d6; }
  .tok-number { color: #d98fd9; }
  .tok-function { color: #e0a35f; }
}
:root[data-theme="dark"] .tok-keyword { color: #9aa8e8; }
:root[data-theme="dark"] .tok-string { color: #6fc9d6; }
:root[data-theme="dark"] .tok-number { color: #d98fd9; }
:root[data-theme="dark"] .tok-function { color: #e0a35f; }
:root[data-theme="light"] .tok-keyword { color: #3a4fa0; }
:root[data-theme="light"] .tok-string { color: #0f6e7a; }
:root[data-theme="light"] .tok-number { color: #8a3d8a; }
:root[data-theme="light"] .tok-function { color: #9c5a1f; }
```

- [ ] **Step 4: Verify the CSS landed correctly**

```bash
grep -c "sandbox-editor-wrap\|tok-keyword\|tok-string\|tok-comment\|tok-number\|tok-function" assets/style.css
```

Expected: a positive count (well over 10, given the light/dark repeats) with no shell/syntax errors from the grep itself.

- [ ] **Step 5: Commit**

```bash
git add assets/syntax-highlight.js assets/style.css
git commit -m "Add DOM overlay wiring and CSS for sandbox editor highlighting"
```

---

### Task 7: Wire into the 8 sandbox pages

**Files:**
- Modify: `python-sandbox.html:8,57,75-77`
- Modify: `java-sandbox.html:9,57,75-81`
- Modify: `javascript-sandbox.html:10,44,61`
- Modify: `cpp-sandbox.html:10,48,65`
- Modify: `pandas-sandbox.html:9,49,66`
- Modify: `python-project.html:8,37`
- Modify: `python-sensor-project.html:8,37`
- Modify: `guided-language-project.html:8,41` and `assets/guided-language-project.js:333` (new line)

**Interfaces:**
- Consumes: `assets/syntax-highlight.js`'s self-attaching behavior (attaches to every `textarea.sandbox-editor` on script load, same pattern `code-editor.js` already uses) and its `data-language` lookup via `.closest()` (Task 6).

Every edit below follows the same two shapes: (a) add `<script src="assets/syntax-highlight.js" defer></script>` immediately after the existing `<script src="assets/code-editor.js" defer></script>` line, and (b) wrap each `<textarea class="sandbox-editor" ...>` in a `<div class="sandbox-editor-wrap" data-language="...">...</div>`. Two files (`python-sandbox.html`, `java-sandbox.html`) have a "free" editor whose default content spans multiple lines — those are spelled out in full below rather than abbreviated, since the wrapper's closing `</div>` has to land after the multi-line content's `</textarea>`, not on the same line as its opening tag.

- [ ] **Step 1: python-sandbox.html (language: python)**

Replace line 8:
```html
<script src="assets/code-editor.js" defer></script>
```
with:
```html
<script src="assets/code-editor.js" defer></script>
<script src="assets/syntax-highlight.js" defer></script>
```

Replace line 57:
```html
      <textarea id="python-code" class="sandbox-editor" data-python-code spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
```
with:
```html
      <div class="sandbox-editor-wrap" data-language="python">
      <textarea id="python-code" class="sandbox-editor" data-python-code spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
      </div>
```

Replace lines 75-77 (the free-editor textarea, whose default content is 3 lines):
```html
    <textarea id="python-free-code" class="sandbox-editor sandbox-editor-free" data-python-free-code spellcheck="false" autocomplete="off" autocapitalize="off">name = "STEM+"
for number in range(1, 4):
    print(f"{number}: Hello from {name}!")</textarea>
```
with:
```html
    <div class="sandbox-editor-wrap" data-language="python">
    <textarea id="python-free-code" class="sandbox-editor sandbox-editor-free" data-python-free-code spellcheck="false" autocomplete="off" autocapitalize="off">name = "STEM+"
for number in range(1, 4):
    print(f"{number}: Hello from {name}!")</textarea>
    </div>
```

- [ ] **Step 2: java-sandbox.html (language: java)**

Replace line 9:
```html
<script src="assets/code-editor.js" defer></script>
```
with:
```html
<script src="assets/code-editor.js" defer></script>
<script src="assets/syntax-highlight.js" defer></script>
```

Replace line 57:
```html
      <textarea id="java-code" class="sandbox-editor" data-java-code spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
```
with:
```html
      <div class="sandbox-editor-wrap" data-language="java">
      <textarea id="java-code" class="sandbox-editor" data-java-code spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
      </div>
```

Replace lines 75-81 (the free-editor textarea, whose default content is 6 lines):
```html
    <textarea id="java-free-code" class="sandbox-editor sandbox-editor-free" data-java-free-code spellcheck="false" autocomplete="off" autocapitalize="off">public class Main {
    public static void main(String[] args) {
        for (int number = 1; number &lt;= 3; number++) {
            System.out.println(number + ": Hello from Java!");
        }
    }
}</textarea>
```
with:
```html
    <div class="sandbox-editor-wrap" data-language="java">
    <textarea id="java-free-code" class="sandbox-editor sandbox-editor-free" data-java-free-code spellcheck="false" autocomplete="off" autocapitalize="off">public class Main {
    public static void main(String[] args) {
        for (int number = 1; number &lt;= 3; number++) {
            System.out.println(number + ": Hello from Java!");
        }
    }
}</textarea>
    </div>
```

- [ ] **Step 3: javascript-sandbox.html (language: javascript)**

Replace line 10:
```html
<script src="assets/code-editor.js" defer></script>
```
with:
```html
<script src="assets/code-editor.js" defer></script>
<script src="assets/syntax-highlight.js" defer></script>
```

Replace line 44:
```html
      <textarea id="js-code" class="sandbox-editor" data-code-editor spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
```
with:
```html
      <div class="sandbox-editor-wrap" data-language="javascript">
      <textarea id="js-code" class="sandbox-editor" data-code-editor spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
      </div>
```

Replace line 61:
```html
    <textarea id="js-free-code" class="sandbox-editor sandbox-editor-free" data-code-free-editor spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
```
with:
```html
    <div class="sandbox-editor-wrap" data-language="javascript">
    <textarea id="js-free-code" class="sandbox-editor sandbox-editor-free" data-code-free-editor spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
    </div>
```

- [ ] **Step 4: cpp-sandbox.html (language: cpp)**

Replace line 10:
```html
<script src="assets/code-editor.js" defer></script>
```
with:
```html
<script src="assets/code-editor.js" defer></script>
<script src="assets/syntax-highlight.js" defer></script>
```

Replace line 48:
```html
      <textarea id="cpp-code" class="sandbox-editor" data-code-editor spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
```
with:
```html
      <div class="sandbox-editor-wrap" data-language="cpp">
      <textarea id="cpp-code" class="sandbox-editor" data-code-editor spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
      </div>
```

Replace line 65:
```html
    <textarea id="cpp-free-code" class="sandbox-editor sandbox-editor-free" data-code-free-editor spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
```
with:
```html
    <div class="sandbox-editor-wrap" data-language="cpp">
    <textarea id="cpp-free-code" class="sandbox-editor sandbox-editor-free" data-code-free-editor spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
    </div>
```

- [ ] **Step 5: pandas-sandbox.html (language: python — Pandas is Python syntax, reuses the Python grammar)**

Replace line 9:
```html
<script src="assets/code-editor.js" defer></script>
```
with:
```html
<script src="assets/code-editor.js" defer></script>
<script src="assets/syntax-highlight.js" defer></script>
```

Replace line 49:
```html
      <textarea id="pandas-code" class="sandbox-editor" data-code-editor spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
```
with:
```html
      <div class="sandbox-editor-wrap" data-language="python">
      <textarea id="pandas-code" class="sandbox-editor" data-code-editor spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
      </div>
```

Replace line 66:
```html
    <textarea id="pandas-free-code" class="sandbox-editor sandbox-editor-free" data-code-free-editor spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
```
with:
```html
    <div class="sandbox-editor-wrap" data-language="python">
    <textarea id="pandas-free-code" class="sandbox-editor sandbox-editor-free" data-code-free-editor spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
    </div>
```

- [ ] **Step 6: python-project.html (language: python)**

Replace line 8:
```html
<script src="assets/code-editor.js" defer></script>
```
with:
```html
<script src="assets/code-editor.js" defer></script>
<script src="assets/syntax-highlight.js" defer></script>
```

Replace line 37:
```html
    <textarea id="python-project-code" class="sandbox-editor sandbox-editor-free" data-project-code spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
```
with:
```html
    <div class="sandbox-editor-wrap" data-language="python">
    <textarea id="python-project-code" class="sandbox-editor sandbox-editor-free" data-project-code spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
    </div>
```

- [ ] **Step 7: python-sensor-project.html (language: python)**

Replace line 8:
```html
<script src="assets/code-editor.js" defer></script>
```
with:
```html
<script src="assets/code-editor.js" defer></script>
<script src="assets/syntax-highlight.js" defer></script>
```

Replace line 37:
```html
    <textarea id="python-sensor-project-code" class="sandbox-editor sandbox-editor-free" data-project-code spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
```
with:
```html
    <div class="sandbox-editor-wrap" data-language="python">
    <textarea id="python-sensor-project-code" class="sandbox-editor sandbox-editor-free" data-project-code spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
    </div>
```

- [ ] **Step 8: guided-language-project.html (language: dynamic — set by JS, not hardcoded) and assets/guided-language-project.js**

This page's language is chosen at runtime (`project.key`, one of `javascript`/`cpp`/`java`). Unlike the other 7 pages, do NOT hardcode a `data-language` attribute in the HTML — it gets set dynamically by `assets/guided-language-project.js` instead (below).

Replace line 8:
```html
<script src="assets/code-editor.js" defer></script>
```
with:
```html
<script src="assets/code-editor.js" defer></script>
<script src="assets/syntax-highlight.js" defer></script>
```

Replace line 41:
```html
    <textarea id="guided-project-code" class="sandbox-editor sandbox-editor-free" data-project-code spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
```
with:
```html
    <div class="sandbox-editor-wrap">
    <textarea id="guided-project-code" class="sandbox-editor sandbox-editor-free" data-project-code spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
    </div>
```

In `assets/guided-language-project.js`, find this existing line (currently line 333):
```js
  document.querySelector('.page').dataset.indentSize = project.indent;
```
and add immediately after it:
```js
  document.querySelector('.page').dataset.language = project.key;
```

This puts `data-language` on the `.page` ancestor rather than the immediate wrapper — `editor.closest('[data-language]')` (Task 6) walks up the full ancestor chain, so it finds this just as reliably as it would on the immediate wrapper. `project.key` values (`javascript`/`cpp`/`java`) match the tokenizer language keys exactly, no translation needed. Since `render()` re-reads the language on every `input` event rather than caching it at attach time, this works correctly even though `attach()` (which runs once, early) may fire before this line sets the attribute — by the time the user types anything, `project.key` has already been assigned during page setup.

- [ ] **Step 9: Verify all 8 pages**

```bash
for f in python-sandbox.html java-sandbox.html javascript-sandbox.html cpp-sandbox.html pandas-sandbox.html python-project.html python-sensor-project.html guided-language-project.html; do
  echo "=== $f ==="
  grep -c "syntax-highlight.js" "$f"
  grep -c "sandbox-editor-wrap" "$f"
done
```

Expected: every file shows `1` for the script-tag count; the wrap count is `2` for the five two-editor pages (python-sandbox, java-sandbox, javascript-sandbox, cpp-sandbox, pandas-sandbox) and `1` for the three single-editor pages (python-project, python-sensor-project, guided-language-project).

```bash
grep -c "data-language=\"python\"" python-sandbox.html python-project.html python-sensor-project.html pandas-sandbox.html
grep -c "data-language=\"java\"" java-sandbox.html
grep -c "data-language=\"javascript\"" javascript-sandbox.html
grep -c "data-language=\"cpp\"" cpp-sandbox.html
grep -c "dataset.language" assets/guided-language-project.js
```

Expected: `2` for python-sandbox.html and pandas-sandbox.html, `1` for python-project.html and python-sensor-project.html; `2` for java-sandbox.html; `2` for javascript-sandbox.html; `2` for cpp-sandbox.html; `1` for the guided-language-project.js line.

- [ ] **Step 10: Run the full test suite**

```bash
npm test
node scripts/check-code-editor.js
node scripts/check-syntax-highlight.js
```

Expected: all three green (existing `npm test` covers session/password checks, unaffected by this work; the other two are this feature's own coverage).

- [ ] **Step 11: Commit**

```bash
git add python-sandbox.html java-sandbox.html javascript-sandbox.html cpp-sandbox.html pandas-sandbox.html python-project.html python-sensor-project.html guided-language-project.html assets/guided-language-project.js
git commit -m "Wire syntax highlighting into all 8 sandbox pages"
```

- [ ] **Step 12: Note for manual verification**

This plan cannot verify the actual rendered result (colors, overlay/textarea pixel alignment, scroll sync, resize behavior) — no display or headless browser is available in this environment. Before considering this feature done, open each of the 8 pages in a real browser (light and dark mode) and confirm: text is legibly colored by category, the overlay tracks the textarea exactly while typing/scrolling/resizing, and the caret remains visible against the highlighted background.
