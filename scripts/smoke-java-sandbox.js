'use strict';

const endpoint = process.argv[2] || 'http://127.0.0.1:9223';
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

(async () => {
  const targets = await (await fetch(`${endpoint}/json`)).json();
  const target = targets.find((item) => item.type === 'page' && item.url.includes('java-sandbox.html'));
  if (!target) throw new Error('Java sandbox browser target not found');

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  const waitFor = async (expression, timeout = 150000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const value = await evaluate(expression);
      if (value) return value;
      await delay(500);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  };

  await command('Runtime.enable');
  await waitFor("document.querySelector('[data-java-run]') && 'ready'", 10000);
  const runProblem = async (id, code) => {
    await evaluate(`(() => {
      const picker = document.querySelector('[data-java-picker]');
      picker.value = ${JSON.stringify(id)};
      picker.dispatchEvent(new Event('change', { bubbles: true }));
      const editor = document.querySelector('[data-java-code]');
      editor.value = ${JSON.stringify(code)};
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('[data-java-run]').click();
    })()`);
    const problemStatus = await waitFor(`(() => {
      const button = document.querySelector('[data-java-run]');
      const text = document.querySelector('[data-java-status]').textContent;
      return !button.disabled && /All tests passed|Run stopped/.test(text) ? text : '';
    })()`);
    const problemResults = await evaluate("document.querySelector('[data-java-results]').textContent");
    if (problemStatus !== 'All tests passed.' || !problemResults.includes('4/4 tests passed')) throw new Error(`${id}: ${problemStatus}\n${problemResults}`);
  };

  await runProblem('java-001', 'public class Main { public static int addNumbers(int a, int b) { return a + b; } }');
  await runProblem('java-027', 'public class Main { public static int[] multiplicationTable(int n) { int[] out = new int[10]; for (int i = 0; i < 10; i++) out[i] = n * (i + 1); return out; } }');
  await runProblem('java-169', 'public class Main { public static int[][] rotateMatrixClockwise(int[][] matrix) { int n = matrix.length; int[][] out = new int[n][n]; for (int row = 0; row < n; row++) for (int col = 0; col < n; col++) out[row][col] = matrix[n - 1 - col][row]; return out; } }');

  await evaluate(`(() => {
    document.querySelector('[data-sandbox-tab="freestyle"]').click();
    const editor = document.querySelector('[data-java-free-code]');
    editor.value = 'public class Main { public static void main(String[] args) { System.out.println(12); } }';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-java-free-run]').click();
  })()`);
  const freeStatus = await waitFor(`(() => {
    const text = document.querySelector('[data-java-free-status]').textContent;
    return /Program finished|Run stopped/.test(text) ? text : '';
  })()`);
  const freeOutput = await evaluate("document.querySelector('[data-java-output]').textContent");
  if (freeStatus !== 'Program finished.' || freeOutput.trim() !== '12') throw new Error(`${freeStatus}\n${freeOutput}`);

  socket.close();
  console.log('Java browser smoke passed: scalar, array, and matrix runners 12/12; freestyle output 12.');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
