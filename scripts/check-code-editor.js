'use strict';

const { keydown } = require('../assets/code-editor.js');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const editor = (value, start, end = start, size = 4) => ({
  value,
  selectionStart: start,
  selectionEnd: end,
  closest() { return { dataset: { indentSize: String(size) } }; },
  setRangeText(text, from, to) { this.value = this.value.slice(0, from) + text + this.value.slice(to); },
  setSelectionRange(from, to) { this.selectionStart = from; this.selectionEnd = to; },
  dispatchEvent() {}
});
const press = (target, key, shiftKey = false) => keydown(target, { key, shiftKey, preventDefault() {} });

let target = editor('return 1;', 0);
press(target, 'Tab');
assert(target.value === '    return 1;' && target.selectionStart === 4, 'Tab indentation failed');

target = editor('    return 1;', 4);
press(target, 'Tab', true);
assert(target.value === 'return 1;' && target.selectionStart === 0, 'Shift+Tab outdent failed');

target = editor('first\nsecond', 0, 12, 2);
press(target, 'Tab');
assert(target.value === '  first\n  second', 'Selected-line indentation failed');

target = editor('if ready:', 9);
press(target, 'Enter');
assert(target.value === 'if ready:\n    ', 'Python block indentation failed');

target = editor('if (ready) {}', 12);
press(target, 'Enter');
assert(target.value === 'if (ready) {\n    \n}', 'Paired-brace indentation failed');

target = editor('    ', 4);
press(target, '}');
assert(target.value === '}', 'Closing-brace outdent failed');

target = editor('      return 1;', 6, 6, 4);
press(target, 'Backspace');
assert(target.value === '    return 1;' && target.selectionStart === 4, 'Backspace should snap to the previous indent stop');

target = editor('    x', 4, 4, 4);
press(target, 'Backspace');
assert(target.value === 'x' && target.selectionStart === 0, 'Backspace at an exact indent stop should remove a full indent unit');

target = editor('  return 1;', 2, 2, 4);
press(target, 'Backspace');
assert(target.value === 'return 1;' && target.selectionStart === 0, 'Backspace with less than one indent unit of whitespace should remove all of it');

target = editor('return 1;', 3, 3, 4);
press(target, 'Backspace');
assert(target.value === 'return 1;' && target.selectionStart === 3, 'Backspace after non-whitespace should not be intercepted, leaving native default behavior to apply');

console.log('Code editor audit passed: Tab, Shift+Tab, selections, auto-indent, brace pairs, smart outdent, and backspace-dedent.');
