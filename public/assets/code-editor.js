(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.STEMCodeEditor = api;
  if (typeof document !== 'undefined') api.attach(document.querySelectorAll('textarea.sandbox-editor'));
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const lineStart = (value, position) => value.lastIndexOf('\n', position - 1) + 1;
  const change = (editor, start, end, text, selectionStart, selectionEnd = selectionStart) => {
    editor.setRangeText(text, start, end);
    editor.setSelectionRange(selectionStart, selectionEnd);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const indentSize = (editor) => Number(editor.closest('[data-indent-size]')?.dataset.indentSize || 4);

  const tab = (editor, backwards) => {
    const { value, selectionStart: start, selectionEnd: end } = editor;
    const first = lineStart(value, start);
    const unit = ' '.repeat(indentSize(editor));
    if (start === end) {
      if (!backwards) return change(editor, start, end, unit, start + unit.length);
      const match = value.slice(first).match(/^(?:\t| {1,4})/);
      if (!match) return;
      const removed = match[0].length;
      return change(editor, first, first + removed, '', Math.max(first, start - removed));
    }

    const adjustedEnd = end > start && value[end - 1] === '\n' ? end - 1 : end;
    const lastBreak = value.indexOf('\n', adjustedEnd);
    const last = lastBreak < 0 ? value.length : lastBreak;
    const lines = value.slice(first, last).split('\n');
    const transformed = lines.map((line) => backwards ? line.replace(/^(?:\t| {1,4})/, '') : unit + line);
    change(editor, first, last, transformed.join('\n'), first, first + transformed.join('\n').length);
  };

  const enter = (editor) => {
    const { value, selectionStart: start, selectionEnd: end } = editor;
    const first = lineStart(value, start);
    const before = value.slice(first, start);
    const indentation = (before.match(/^[ \t]*/) || [''])[0];
    const unit = ' '.repeat(indentSize(editor));
    const trimmed = before.trimEnd();
    const opener = trimmed.slice(-1);
    const opensBlock = /[:{[(]/.test(opener);
    const next = value.slice(end).match(/^\s*([}\])])/)?.[1];
    const pairs = { '{': '}', '[': ']', '(': ')' };
    if (pairs[opener] && pairs[opener] === next) {
      const text = `\n${indentation}${unit}\n${indentation}`;
      return change(editor, start, end, text, start + 1 + indentation.length + unit.length);
    }
    const added = opensBlock ? unit : '';
    const text = `\n${indentation}${added}`;
    change(editor, start, end, text, start + text.length);
  };

  const close = (editor, character) => {
    const { value, selectionStart: start, selectionEnd: end } = editor;
    if (start !== end) return false;
    const first = lineStart(value, start);
    const before = value.slice(first, start);
    if (!/^[ \t]+$/.test(before)) return false;
    const amount = Math.min(before.length, indentSize(editor));
    change(editor, start - amount, start, character, start - amount + 1);
    return true;
  };

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
  const attach = (editors) => editors.forEach((editor) => editor.addEventListener('keydown', (event) => keydown(editor, event)));

  return { attach, keydown };
}));
