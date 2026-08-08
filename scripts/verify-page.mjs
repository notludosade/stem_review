#!/usr/bin/env node
// One-off browser verification helper for Phase B migration checks.
// Usage: node scripts/verify-page.mjs <url> <js-expression-to-evaluate>
// The JS expression runs in the page after load and must return a JSON-serializable
// value; a truthy `ok` field (or a plain truthy value) is treated as pass.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const [, , url, expression] = process.argv;
if (!url || !expression) {
  console.error('Usage: node scripts/verify-page.mjs <url> <js-expression>');
  process.exit(1);
}

const port = 9333;
const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/phase-b-verify-profile', 'about:blank'],
  { stdio: 'ignore' }
);

try {
  await sleep(800); // let Chrome's debugging port come up
  const newTabRes = await fetch(`http://localhost:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  await sleep(1500); // let the page finish loading and hydrating

  const result = await new Promise((resolve, reject) => {
    const id = 1;
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
  console.log('Result:', JSON.stringify(result));
  const pass = result && (result === true || result.ok === true);
  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
} finally {
  chrome.kill();
}
