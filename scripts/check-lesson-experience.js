'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'pages/[[...slug]].tsx'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/assets/lesson-experience.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/assets/style.css'), 'utf8');

assert.match(route, /isLesson[\s\S]*lesson-experience\.js/, 'catch-all route does not load the shared lesson experience');
['Learn it', 'Study it', 'Apply it', 'What to remember', 'Real-world scenario'].forEach((label) => assert(script.includes(label), `lesson experience missing ${label}`));
['.lesson-path', '.lesson-stage', '.lesson-concept-block', '.lesson-apply-scenario'].forEach((selector) => assert(css.includes(selector), `lesson styles missing ${selector}`));
assert(script.includes('what it means, when it is used, and how it connects'), 'lesson introduction does not provide enough plain-language context');
assert(css.includes('line-height: 1.65'), 'lesson descriptions need readable spacing');
assert.match(script, /page\.querySelector\('\[data-test\]'\)/, 'tests must be excluded from lesson restructuring');

console.log('check-lesson-experience: OK (shared Learn it / Study it / Apply it renderer wired to every lesson route)');
