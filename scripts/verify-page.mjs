#!/usr/bin/env node
// One-off browser verification helper for Phase B migration checks.
// Usage: node scripts/verify-page.mjs <url> <js-expression-to-evaluate> [cookie]
// The JS expression runs in the page after load and must return a JSON-serializable
// value; a truthy `ok` field (or a plain truthy value) is treated as pass.
// Optional [cookie] is "name=value" — set via CDP before navigation, for pages
// gated by proxy.ts's session check. Needed because the session cookie (unlike
// localStorage, which this script's persistent --user-data-dir already carries
// across separate invocations) does not reliably survive a SIGKILL between
// invocations: Chrome's cookie store flush-to-disk interval is longer than
// localStorage's, so a value obtained once (e.g. via a curl login) must be
// re-supplied per invocation rather than assumed to persist in the profile.
import { spawn, execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const [, , url, expression, cookie] = process.argv;
if (!url || !expression) {
  console.error('Usage: node scripts/verify-page.mjs <url> <js-expression> [cookie]');
  process.exit(1);
}

const port = 9333;
// detached: true puts Chrome (and the helper processes it forks) in their own
// process group, so we can kill the whole tree by signaling -chrome.pid instead
// of just the immediate child, which macOS Chrome otherwise survives.
const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/phase-b-verify-profile', 'about:blank'],
  { stdio: 'ignore', detached: true }
);

// Kill the whole Chrome process group, then fall back to killing anything still
// bound to the debug port — Chrome's helper/renderer/GPU processes don't always
// share the leader's process group on macOS, so the group kill alone isn't reliable.
function killChromeTree() {
  try {
    process.kill(-chrome.pid, 'SIGKILL');
  } catch {
    // process/group may already be gone
  }
  try {
    // -sTCP:LISTEN matters: plain `lsof -ti tcp:PORT` also matches this very
    // script's own outbound WebSocket connection to Chrome (the client side of
    // the same port number), which would SIGKILL our own process mid-cleanup.
    // Restrict to the listening (server) socket, and exclude our own pid as a
    // second guard against ever self-killing.
    const pids = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((pid) => Number(pid) !== process.pid);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGKILL');
      } catch {
        // already dead
      }
    }
  } catch {
    // lsof found nothing on the port, or isn't available — nothing to clean up
  }
}

// Poll Chrome's debugging port instead of guessing a fixed sleep — the port can
// take longer than any fixed delay to come up under load, and a guess either
// wastes time or races and fails intermittently.
async function waitForCdp(timeoutMs = 5000, intervalMs = 150) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/json/version`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(intervalMs);
  }
  throw new Error(`Chrome debugging port ${port} did not come up within ${timeoutMs}ms`);
}

// NOTE: process.exit() must never be called from inside the try block below.
// In Node.js, process.exit() terminates the process immediately and does NOT
// run pending finally blocks — calling it inside try silently skips cleanup.
// (Verified: a try { process.exit(0) } finally { ... } never runs the finally.)
// So we only ever set `exitCode` inside try/catch and call process.exit(exitCode)
// once, after the try/catch/finally has fully completed.
let exitCode = 1;
try {
  await waitForCdp();
  // With a cookie to set, open blank first — the cookie must exist before
  // the gated page's own navigation triggers proxy.ts's session check, so
  // this can't use /json/new's own direct-to-url shortcut below.
  const newTabRes = await fetch(`http://localhost:${port}/json/new?${encodeURIComponent(cookie ? 'about:blank' : url)}`, { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  let nextId = 1;
  function send(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      ws.addEventListener('message', function handler(event) {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(new Error(JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  if (cookie) {
    const eq = cookie.indexOf('=');
    const name = cookie.slice(0, eq);
    const value = cookie.slice(eq + 1);
    await send('Network.setCookie', { url, name, value, path: '/', secure: true, sameSite: 'Lax' });
    await send('Page.navigate', { url });
  }

  await sleep(1500); // let the page finish loading and hydrating

  const result = await new Promise((resolve, reject) => {
    const id = nextId++;
    ws.addEventListener('message', function handler(event) {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.result?.exceptionDetails) reject(new Error(JSON.stringify(msg.result.exceptionDetails)));
        else resolve(msg.result.result.value);
      }
    });
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
  });

  await fetch(`http://localhost:${port}/json/close/${tab.id}`);
  // Chrome's localStorage backend batches writes to disk rather than flushing
  // synchronously on setItem(). If an expression writes to localStorage (e.g.
  // seeding test data for a later, separate invocation to read), a SIGKILL
  // immediately after evaluate returns can kill Chrome before that write
  // reaches the profile directory — the write succeeds in-page but silently
  // never persists. This delay is cheap for read-only checks and is what
  // makes seed-then-read across two separate invocations actually reliable.
  await sleep(500);
  console.log('Result:', JSON.stringify(result));
  const pass = result && (result === true || result.ok === true);
  console.log(pass ? 'PASS' : 'FAIL');
  exitCode = pass ? 0 : 1;
} catch (err) {
  console.error('Verification failed:', err instanceof Error ? err.message : err);
  exitCode = 1;
} finally {
  killChromeTree();
}
process.exit(exitCode);
