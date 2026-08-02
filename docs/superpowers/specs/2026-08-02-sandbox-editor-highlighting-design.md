# Sandbox Editor: Syntax Highlighting + Backspace-Dedent — Design

## Context

STEM+'s code sandboxes (`python-sandbox.html`, `java-sandbox.html`, `javascript-sandbox.html`, `cpp-sandbox.html`, `pandas-sandbox.html`, `python-project.html`, `python-sensor-project.html`, `guided-language-project.html` — 8 pages, 4 language grammars since Pandas uses Python syntax) all share one component: `assets/code-editor.js`, wired to `<textarea class="sandbox-editor">`. It already has real hand-rolled smart-editing logic — Tab/Shift+Tab multi-line indent/dedent (respecting a per-page `data-indent-size`, default 4), Enter auto-indent with paired-bracket block expansion, and closing-bracket "outdent onto" behavior — all built on native textarea APIs (`selectionStart`/`selectionEnd`, `setRangeText`). There is no syntax highlighting (plain textarea) and no Backspace handler (browser default: delete one character).

A headless test, `scripts/check-code-editor.js`, exercises the keydown logic (`tab()`, `enter()`, `close()`) via a fake DOM-node object — no real browser needed. This is the established test pattern for this component.

## Goals

- Backspace, when the cursor sits in pure leading whitespace, removes back to the previous indent stop (not one character).
- Real syntax highlighting (keywords, strings, comments, numbers, function calls) for Python, Java, JavaScript, and C++, matching the general convention of standard IDEs/interpreters.
- Zero risk to the existing, tested Tab/Enter/bracket-pairing behavior.
- No new runtime dependency, no CDN, no build step — consistent with the rest of the site.

## Non-goals

- Not adopting an editor library (CodeMirror/Ace/Monaco) — see Approach below for why.
- Not handling literal tab characters in the new backspace logic — the editor only ever inserts spaces; a leading literal tab (only possible via pasted code) falls through to default single-char delete. Documented gap, not a bug.
- Not building a general-purpose/extensible tokenizer framework for arbitrary future languages — four concrete grammars, YAGNI beyond that.

## Approach

**Rejected: adopt an existing editor library.** CodeMirror/Ace are contenteditable/custom-DOM based, not native textareas. Adopting one means discarding and rebuilding the entire existing keydown logic (Tab/Enter/bracket-pairing) around the library's own editing API, and very likely discarding the current headless-testable approach. Much bigger, riskier change than the request calls for.

**Chosen: overlay highlighting on the existing textarea.** The native textarea and all its current logic stay completely untouched. Each `.sandbox-editor` gets wrapped in a new positioned container holding a `<pre><code>` layer directly behind it. The textarea's own text is rendered transparent (only the caret shows); the `<pre>` underneath shows the same text with token-classified `<span>` wrapping, recomputed on every `input` event and scroll-synced with the textarea. Both layers share identical font/line-height/padding so characters align exactly. This is the same technique real syntax highlighters use for "fake" textarea-backed editors — nothing novel, well-understood, and additive: backspace-dedent and the tokenizer are both new, independently-testable pure functions, same pattern as the existing `tab()`/`enter()`.

## Backspace-dedent

New `backspace(editor)` in `assets/code-editor.js`, same style as `tab()`/`enter()`. Only activates when the selection is collapsed and everything from line-start to the cursor is spaces (any other case — mid-word, after non-whitespace, empty prefix — falls through to the browser default, `return false`).

Removes back to the previous multiple of the page's indent size, snapping like every mainstream editor's soft-tab backspace: with a 4-space indent, cursor at column 6 → removes 2 (lands at 4); column 4 → removes 4 (lands at 0); column 8 → removes 4 (lands at 4). Formula: `remove = ((column - 1) % indentSize) + 1`, where `column` is the length of the all-space prefix.

## Syntax highlighting

New `assets/syntax-highlight.js`, two pieces:

**1. Tokenizers (pure, headlessly testable).** One function per language (`tokenizePython`, `tokenizeJava`, `tokenizeJavaScript`, `tokenizeCpp`), each a single linear regex-driven scan over the full text (not naive per-line splitting) so multi-line constructs work correctly — Python triple-quoted strings, C-style `/* */` block comments in Java/JS/C++. Each returns an ordered list of `{ type, text }` tokens covering the entire input (including whitespace/punctuation as `type: 'text'`), where `type` is one of `keyword | string | comment | number | function | text`. A shared `tokenize(code, language)` dispatches to the right one. Tested the same way `tab()`/`enter()` are — plain input/output assertions, no DOM, no browser.

**2. DOM wiring (browser-only, thin).** Attaches to the same `.sandbox-editor` elements code-editor.js already attaches to. Builds the wrapper + `<pre><code>` overlay once per editor, re-renders tokens into it on every `input` event (mapping each token to a `<span class="tok-{type}">`, `text` tokens unwrapped), and mirrors `scrollTop`/`scrollLeft` on the textarea's `scroll` event so the overlay tracks scrolling. Reads which language to tokenize with from a new `data-language="python|java|javascript|cpp"` attribute on the wrapper element (read via `.closest()`, the same lookup pattern `code-editor.js` already uses for `data-indent-size`).

**3. Colors.** New `.tok-keyword`/`.tok-string`/`.tok-comment`/`.tok-number`/`.tok-function` rules in `style.css`, following the same 4-scope-block light/dark pattern already used twice (tier, category colors). Chosen to be clearly distinguishable from each other and — the specific lesson from the last feature's review — checked against `--correct`/`--incorrect` and the sandbox category's accent color, since those can appear on the same sandbox pages at the same time as editor text. Comments reuse the existing `--muted` token (italicized) rather than introducing a new color, since "de-emphasized gray" is both the universal convention and a zero-collision-risk choice.

## Markup changes

Each of the 8 pages' existing `<textarea class="sandbox-editor">` gets wrapped in a new container div carrying `data-language`. The `.page`-level `data-tier`/`data-category`/`data-indent-size` attributes are untouched — this is a purely additive wrapper, not a restructure.

## Testing

`scripts/check-code-editor.js` gets new cases for `backspace()` (mirroring its existing style). A new `scripts/check-syntax-highlight.js` tests each language's tokenizer against representative snippets (keyword recognition, string with embedded quotes, single-line and multi-line comments, numbers, a function call) — pure input/output, no browser. The actual visual result (do the colors render, does the overlay align pixel-perfectly with the textarea, does scrolling stay in sync) cannot be verified in this environment (no display/headless browser available) and needs the user's own look in a real browser before this is considered fully done — consistent with how the last two features ended.
