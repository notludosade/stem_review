# Manual Developer Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop dev mode from silently re-enabling itself for the recognized developer account, and give real manual on/off control instead — including over the reveal-answers feature.

**Architecture:** One markup change (`content/developer.html`, a new hidden button + a wrapped passcode row) and two JS changes in the same function/sibling function in `public/assets/tests.js` — no new files, no new storage keys, no server changes.

**Tech Stack:** Static HTML content file, the existing `window.STEMPlusTests` IIFE in `public/assets/tests.js`.

## Global Constraints

- Do not change what `isDevMode()` unlocks elsewhere (course/pathway/route/project gates) — those checks stay untouched.
- Do not change `window.STEMPlusDev.isDeveloper`'s verification (`/api/me`-backed) — it remains the mandatory first gate for reveal-answers; `isDevMode()` is an additional client-side toggle on top of it, not a replacement.
- Non-recognized visitors (anyone who knows the public passcode) must see the exact same passcode input + Unlock button flow as today — zero behavior change for them.
- `autoUnlockIfRecognized()` is deleted entirely — nothing may call `setDevMode(true)` except an explicit user click.

---

### Task 1: Manual toggle + reveal-answers gating

**Files:**
- Modify: `content/developer.html`
- Modify: `public/assets/tests.js` (`mountDevModePage`, `maybeAddDevReveal`)

**Interfaces:**
- Consumes: `isDevMode()`, `setDevMode(on)`, `DEV_CODE` (all pre-existing, unchanged), `window.STEMPlusDev.isDeveloper` / `window.STEMPlusDevReady` (pre-existing, unchanged).
- Produces: nothing new for other code to consume — this is a self-contained UI/behavior fix.

- [ ] **Step 1: Add the "Turn On Developer Mode" button to `content/developer.html`**

Replace:

```html
  <p class="subtitle">For site maintainers testing gated content. The correct code unlocks every course exam gate, pathway exam gate, route lock, and project gate in this browser — it doesn't grant edit access, and it doesn't affect anyone else's browser. This is a static site with no backend, so this is a convenience toggle for testing, not real access control.</p>
  <p class="nav-links"><a href="index.html" class="nav-toc">← STEM+ Home</a></p>

  <div class="widget" data-devmode>
    <p class="widget-label">Enter developer code</p>
    <div class="fm-row" style="gap:0.6rem;">
      <input type="password" data-devmode-input aria-label="Developer code" placeholder="Code" style="flex:1;">
      <button class="widget-btn" data-devmode-submit type="button">Unlock</button>
    </div>
    <p class="verdict" data-devmode-status hidden></p>
    <button class="widget-btn" data-devmode-clear type="button" hidden>Turn Off Developer Mode</button>
  </div>
```

with:

```html
  <p class="subtitle">For site maintainers testing gated content. The correct code unlocks every course exam gate, pathway exam gate, route lock, and project gate in this browser, and lets you reveal quiz answers — it doesn't grant edit access, and it doesn't affect anyone else's browser. This is a static site with no backend, so this is a convenience toggle for testing, not real access control.</p>
  <p class="nav-links"><a href="index.html" class="nav-toc">← STEM+ Home</a></p>

  <div class="widget" data-devmode>
    <p class="widget-label">Enter developer code</p>
    <div class="fm-row" style="gap:0.6rem;" data-devmode-code-row>
      <input type="password" data-devmode-input aria-label="Developer code" placeholder="Code" style="flex:1;">
      <button class="widget-btn" data-devmode-submit type="button">Unlock</button>
    </div>
    <button class="widget-btn" data-devmode-recognized-on type="button" hidden>Turn On Developer Mode</button>
    <p class="verdict" data-devmode-status hidden></p>
    <button class="widget-btn" data-devmode-clear type="button" hidden>Turn Off Developer Mode</button>
  </div>
```

- [ ] **Step 2: Replace `mountDevModePage` in `public/assets/tests.js`**

Replace the current function (lines 1471-1531):

```js
  function mountDevModePage(el) {
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';
    const input = el.querySelector('[data-devmode-input]');
    const submit = el.querySelector('[data-devmode-submit]');
    const status = el.querySelector('[data-devmode-status]');
    const clearBtn = el.querySelector('[data-devmode-clear]');

    function refresh(autoRecognized) {
      if (isDevMode()) {
        if (status) {
          status.textContent = autoRecognized
            ? 'Recognized this account as the developer — mode enabled automatically, no code needed.'
            : 'Developer mode is ON in this browser — every gate is unlocked.';
          status.hidden = false;
          status.classList.add('is-correct');
          status.classList.remove('is-incorrect');
        }
        if (clearBtn) clearBtn.hidden = false;
      } else {
        if (clearBtn) clearBtn.hidden = true;
      }
    }
    refresh();

    // The server-verified account (see the isDeveloper check near the top
    // of this file) skips typing the code entirely — it's already proven
    // who they are via their signed-in session, so re-typing a code that's
    // sitting in this same file's public source would just be theater.
    function autoUnlockIfRecognized(isDeveloper) {
      if (isDeveloper && !isDevMode()) {
        setDevMode(true);
        refresh(true);
      }
    }
    if (window.STEMPlusDev && window.STEMPlusDev.isDeveloper) {
      autoUnlockIfRecognized(true);
    } else if (window.STEMPlusDevReady) {
      window.STEMPlusDevReady.then(autoUnlockIfRecognized);
    }

    if (submit) {
      submit.addEventListener('click', () => {
        const val = input ? input.value.trim() : '';
        if (val === DEV_CODE) {
          setDevMode(true);
          refresh();
        } else if (status) {
          status.textContent = 'Incorrect code.';
          status.hidden = false;
          status.classList.add('is-incorrect');
          status.classList.remove('is-correct');
        }
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        setDevMode(false);
        if (status) status.hidden = true;
        refresh();
      });
    }
  }
```

with:

```js
  function mountDevModePage(el) {
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';
    const codeRow = el.querySelector('[data-devmode-code-row]');
    const input = el.querySelector('[data-devmode-input]');
    const submit = el.querySelector('[data-devmode-submit]');
    const status = el.querySelector('[data-devmode-status]');
    const clearBtn = el.querySelector('[data-devmode-clear]');
    const recognizedOnBtn = el.querySelector('[data-devmode-recognized-on]');
    let recognized = false;

    // The server-verified account (see the isDeveloper check near the top
    // of this file) never has to type the code — it's already proven who
    // they are via their signed-in session — but dev mode itself only ever
    // turns on when they click something. It used to auto-enable itself on
    // every visit to this page; that silently overrode "Turn Off Developer
    // Mode" the moment they came back, so it's a plain click now instead.
    function refresh() {
      if (isDevMode()) {
        if (status) {
          status.textContent = recognized
            ? 'Developer mode is ON in this browser — every gate is unlocked and quiz answers can be revealed.'
            : 'Developer mode is ON in this browser — every gate is unlocked.';
          status.hidden = false;
          status.classList.add('is-correct');
          status.classList.remove('is-incorrect');
        }
        if (clearBtn) clearBtn.hidden = false;
        if (codeRow) codeRow.hidden = true;
        if (recognizedOnBtn) recognizedOnBtn.hidden = true;
      } else if (recognized) {
        if (clearBtn) clearBtn.hidden = true;
        if (codeRow) codeRow.hidden = true;
        if (recognizedOnBtn) recognizedOnBtn.hidden = false;
        if (status) {
          status.textContent = 'Recognized this account as the developer — turn on Developer Mode whenever you need it.';
          status.hidden = false;
          status.classList.add('is-correct');
          status.classList.remove('is-incorrect');
        }
      } else {
        if (clearBtn) clearBtn.hidden = true;
        if (codeRow) codeRow.hidden = false;
        if (recognizedOnBtn) recognizedOnBtn.hidden = true;
      }
    }
    refresh();

    function onRecognized(isDeveloper) {
      recognized = !!isDeveloper;
      refresh();
    }
    if (window.STEMPlusDev && window.STEMPlusDev.isDeveloper) {
      onRecognized(true);
    } else if (window.STEMPlusDevReady) {
      window.STEMPlusDevReady.then(onRecognized);
    }

    if (submit) {
      submit.addEventListener('click', () => {
        const val = input ? input.value.trim() : '';
        if (val === DEV_CODE) {
          setDevMode(true);
          refresh();
        } else if (status) {
          status.textContent = 'Incorrect code.';
          status.hidden = false;
          status.classList.add('is-incorrect');
          status.classList.remove('is-correct');
        }
      });
    }
    if (recognizedOnBtn) {
      recognizedOnBtn.addEventListener('click', () => {
        setDevMode(true);
        refresh();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        setDevMode(false);
        if (status) status.hidden = true;
        refresh();
      });
    }
  }
```

- [ ] **Step 3: Gate `maybeAddDevReveal` on `isDevMode()`**

Replace (lines 1297-1305):

```js
  function maybeAddDevReveal(container) {
    if (window.STEMPlusDev && window.STEMPlusDev.isDeveloper) {
      addDevRevealButton(container);
    } else if (window.STEMPlusDevReady) {
      window.STEMPlusDevReady.then(function (isDeveloper) {
        if (isDeveloper) addDevRevealButton(container);
      });
    }
  }
```

with:

```js
  function maybeAddDevReveal(container) {
    if (window.STEMPlusDev && window.STEMPlusDev.isDeveloper) {
      if (isDevMode()) addDevRevealButton(container);
    } else if (window.STEMPlusDevReady) {
      window.STEMPlusDevReady.then(function (isDeveloper) {
        if (isDeveloper && isDevMode()) addDevRevealButton(container);
      });
    }
  }
```

- [ ] **Step 4: `npm run build`**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Verify against a production build**

```bash
npm run build && npm run start > /tmp/next-start.log 2>&1 &
```
Wait for `Ready`. Use this session cookie (the existing throwaway developer test account, `is_developer=true`) as `scripts/verify-page.mjs`'s 3rd argument: `session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc`.

Reset to a clean state, then confirm the recognized-but-off state shows the "Turn On" button, not the passcode row:

```bash
node scripts/verify-page.mjs "http://localhost:3000/developer.html" "(() => { localStorage.removeItem('stemplus:devmode:v1'); return { ok: true }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
node scripts/verify-page.mjs "http://localhost:3000/developer.html" "(() => { const onBtn = document.querySelector('[data-devmode-recognized-on]'); const codeRow = document.querySelector('[data-devmode-code-row]'); return { ok: !onBtn.hidden && codeRow.hidden, onHidden: onBtn.hidden, codeRowHidden: codeRow.hidden }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` — "Turn On Developer Mode" button visible, passcode row hidden, and `stemplus:devmode:v1` was NOT auto-set (confirmed by the fact the "Turn On" button is showing at all — if it had auto-enabled, this branch wouldn't render).

Click "Turn On Developer Mode," confirm dev mode turns on and reveal-answers appears on a real quiz page:

```bash
node scripts/verify-page.mjs "http://localhost:3000/developer.html" "(() => { document.querySelector('[data-devmode-recognized-on]').click(); return { ok: localStorage.getItem('stemplus:devmode:v1') === 'true' }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
node scripts/verify-page.mjs "http://localhost:3000/AP%20Physics%201/Unit%201/unit-test-a.html" "(() => { return { ok: !!document.querySelector('[data-test-devreveal]') }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` on both — dev mode flag set to `'true'` after the click, and the reveal-answers button (`[data-test-devreveal]`) is present on a real, ungated unit-test page once dev mode is on. (Deliberately using an ungated unit test, not a course-exam page behind `data-exam-gate` — `isDevMode()` also bypasses that gate, which would conflate "the gate unlocked" with "reveal-answers appeared," the two different things this step needs to tell apart.)

Turn it off, reload `developer.html`, confirm it stays off (the actual regression this fixes) and reveal-answers disappears:

```bash
node scripts/verify-page.mjs "http://localhost:3000/developer.html" "(() => { document.querySelector('[data-devmode-clear]').click(); return { ok: localStorage.getItem('stemplus:devmode:v1') === 'false' }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
node scripts/verify-page.mjs "http://localhost:3000/developer.html" "(() => { return { ok: localStorage.getItem('stemplus:devmode:v1') === 'false' }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
node scripts/verify-page.mjs "http://localhost:3000/AP%20Physics%201/Unit%201/unit-test-a.html" "(() => { return { ok: !document.querySelector('[data-test-devreveal]') }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` on all three — dev mode is `'false'` immediately after clicking "Turn Off," **stays `'false'` after a fresh page load** (this is the exact bug: before this fix, this second check would fail because the page load itself would flip it back to `'true'`), and reveal-answers is gone from the quiz page.

Clean up:

```bash
node scripts/verify-page.mjs "http://localhost:3000/developer.html" "(() => { localStorage.removeItem('stemplus:devmode:v1'); return { ok: true }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```

Confirm non-recognized visitors see no change — the passcode flow still works with no session cookie:

```bash
node scripts/verify-page.mjs "http://localhost:3000/developer.html" "(() => { const codeRow = document.querySelector('[data-devmode-code-row]'); const onBtn = document.querySelector('[data-devmode-recognized-on]'); return { ok: !codeRow.hidden && onBtn.hidden }; })()"
```
Expected: `PASS` — passcode row visible, "Turn On" button hidden, for an unauthenticated visitor.

Stop the server: `lsof -ti tcp:3000 -sTCP:LISTEN | xargs kill -9`

- [ ] **Step 6: `npm test`**

Run: `npm test`
Expected: all 5 checks pass.

- [ ] **Step 7: Commit**

```bash
git add content/developer.html public/assets/tests.js
git commit -m "$(cat <<'EOF'
Make developer mode a real manual toggle, not auto-re-enabling

mountDevModePage used to call setDevMode(true) automatically every
time the recognized developer account visited developer.html while
dev mode was off — silently undoing "Turn Off Developer Mode" the
moment they came back to the page. Replaced with a one-click "Turn On
Developer Mode" button (still no passcode needed, the account is
already server-verified) — nothing flips the flag except an explicit
click now.

maybeAddDevReveal's "Show Answers (Developer)" button also used to
ignore dev mode's state entirely, showing for the developer account
regardless. It now requires dev mode to be on too, so turning dev
mode off gives a genuine "see it as a student" view instead of
reveal-answers staying stuck on.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** forced auto-enable removed (Step 2, `autoUnlockIfRecognized` deleted entirely), one-click "Turn On" for recognized developers with no passcode (Step 1 markup + Step 2 `recognizedOnBtn` handler), "Turn Off" continues working and now actually persists (Step 2's `else if (recognized)` / plain-off branches, explicitly tested in Step 5's stays-off check), reveal-answers gated on `isDevMode()` (Step 3, tested in Step 5), non-recognized visitors unchanged (Step 2's plain-off branch identical in effect to the original passcode-only flow, explicitly tested in Step 5's final check). All spec sections covered.
- **Placeholder scan:** none — every step has complete code or a runnable command with a stated expected result.
- **Type consistency:** `mountDevModePage` and `maybeAddDevReveal` signatures unchanged (`el`/`container` params). New DOM hooks (`data-devmode-code-row`, `data-devmode-recognized-on`) introduced once in Step 1's markup and consumed once in Step 2's JS — no naming drift.
