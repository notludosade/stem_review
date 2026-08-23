# Manual Developer Mode Toggle — Design

## Context

The site has a "Developer Mode" concept (`isDevMode()`/`setDevMode()`, a plain `localStorage` flag, `public/assets/tests.js:284-299`) that unlocks every course/pathway exam gate, route lock, and project gate in the current browser — a QA convenience, not real access control (the unlock passcode ships in this file's public source). `content/developer.html:12-20` already has a full manual UI for it: a passcode input + Unlock button, and a "Turn Off Developer Mode" button.

Separately, `window.STEMPlusDev.isDeveloper` (`tests.js:130-141`) is a server-verified flag — true only after `/api/me` confirms it against the signed session cookie for the site-owner's account. It currently drives one independent capability: `maybeAddDevReveal` (`tests.js:1297-1305`) adds a "Show Answers (Developer)" button to every quiz/test page whenever it's true, regardless of the `isDevMode()` toggle's state.

The bug: `mountDevModePage`'s `autoUnlockIfRecognized()` (`tests.js:1497-1502`) calls `setDevMode(true)` automatically every time the recognized developer visits `developer.html` while dev mode is off — silently re-enabling it even right after they explicitly turn it off via the existing "Turn Off Developer Mode" button. This is the reported "auto turning on dev mode every time a dev enters the page." Combined with reveal-answers' independence from the toggle, the developer account effectively can never turn "developer behavior" fully off.

## Goals

- Recognized developers get real manual control: dev mode never turns itself back on. When off, they see a one-click **"Turn On Developer Mode"** button (still no passcode needed — they're already server-verified) instead of it happening automatically.
- The existing "Turn Off Developer Mode" button continues to work exactly as today, and now actually stays off across future visits until they explicitly turn it back on.
- `maybeAddDevReveal` gates on `window.STEMPlusDev.isDeveloper && isDevMode()` — reveal-answers only appears when dev mode is toggled on, so turning dev mode off gives a clean "see it as a student" view.
- Non-recognized visitors (anyone who knows the public passcode) see the exact same passcode input + Unlock button flow as today — this design changes nothing for them.

## Non-goals

- Not changing what `isDevMode()` unlocks elsewhere (course/pathway/route/project gates) — those checks are untouched.
- Not adding server-side enforcement or changing `window.STEMPlusDev.isDeveloper`'s verification (`/api/me`-backed, unspoofable) — still the mandatory first gate for reveal-answers; `isDevMode()` is an additional, purely client-side convenience layer on top of it, not a replacement.
- Not touching the passcode value or distribution — still a documented low-stakes convenience, unchanged.

## Design

**`content/developer.html`:** wrap the existing passcode row in `data-devmode-code-row`, and add one new hidden button after it:

```html
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

Subtitle paragraph gains one clause noting reveal-answers now lives under this same toggle.

**`mountDevModePage` (`tests.js`):** track whether the account is recognized in a closure variable (set once the `/api/me` check resolves, same async source as today), and have a single `refresh()` re-render three states:
1. **Dev mode ON:** passcode row hidden, "Turn On" button hidden, "Turn Off" button shown, status describes the unlocked gates (and, if recognized, mentions reveal-answers).
2. **Dev mode OFF, recognized:** passcode row hidden (no code needed), "Turn On" button shown, status explains they're recognized and can turn it on whenever.
3. **Dev mode OFF, not recognized:** passcode row shown (today's exact behavior), both other buttons hidden.

`autoUnlockIfRecognized()` is deleted — nothing calls `setDevMode(true)` except an explicit click on "Unlock" (correct passcode) or "Turn On Developer Mode".

**`maybeAddDevReveal` (`tests.js:1297-1305`):** add `isDevMode()` as a second required condition in both the synchronous and the async (`STEMPlusDevReady.then(...)`) branches.

## Testing

Same discipline as recent phases: `scripts/verify-page.mjs` against `npm run build && npm run start`, using the existing developer test account's session cookie.

- Recognized developer, dev mode off: `developer.html` shows the "Turn On Developer Mode" button, not the passcode row; clicking it turns dev mode on and reveal-answers starts appearing on a quiz page.
- Recognized developer, dev mode on: reload `developer.html` — dev mode stays on (not the point of this fix, but confirms nothing flips it off unexpectedly either) and the "Turn Off" button is present.
- Recognized developer clicks "Turn Off Developer Mode," then reloads `developer.html`: dev mode stays OFF (the actual regression this fixes — today it would auto-flip back on), and a quiz page no longer shows the reveal-answers button.
- Non-recognized session: `developer.html` still shows the passcode row unchanged; entering the correct code still turns dev mode on via the existing `data-devmode-submit` flow.
- `npm test` passes.
