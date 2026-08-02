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

// Java
found = types('public class Main {\n  // entry\n  public static void main(String[] args) {\n    System.out.println("hi");\n  }\n}\n', 'java');
assert(found.includes('keyword:public'), 'Java keyword not detected');
assert(found.includes('comment:// entry'), 'Java line comment not detected');
assert(found.includes('function:println'), 'Java function-call name not detected');
assert(found.includes('string:"hi"'), 'Java string not detected');

found = types('/* block\ncomment */\nint x = 5;\n', 'java');
assert(found.some((t) => t.startsWith('comment:') && t.includes('block') && t.includes('comment')), 'Java multi-line comment not detected');

// JavaScript
found = types('function add(a, b) {\n  return a + b; // sum\n}\n', 'javascript');
assert(found.includes('keyword:function'), 'JavaScript keyword not detected');
assert(found.includes('function:add'), 'JavaScript function-call name not detected');
assert(found.includes('comment:// sum'), 'JavaScript comment not detected');

found = types('const msg = `hi ${1}`;\n', 'javascript');
assert(found.some((t) => t.startsWith('string:') && t.includes('hi')), 'JavaScript template string not detected');

// render()
const fakePre = { innerHTML: '' };
render(fakePre, 'def f():', 'python');
assert(fakePre.innerHTML.includes('<span class="tok-keyword">def</span>'), 'render() should wrap keyword tokens in a tok-keyword span');
assert(fakePre.innerHTML.includes('<span class="tok-function">f</span>'), 'render() should wrap function-call tokens in a tok-function span');

console.log('check-syntax-highlight: Python, Java, JavaScript OK');
