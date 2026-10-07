'use strict';

const assert = require('node:assert');
const catalog = require('../public/assets/skill-catalog.json');
const { buildSearchIndex, searchIndex, normalize } = require('../lib/global-search');

const seeds = [
  { type: 'COURSE', title: 'AP Calculus BC', href: '/AP%20STEM%2B/AP_CALC/index.html', context: 'Math' },
  { type: 'PRACTICE', title: 'AP Calculus BC', href: '/problem-set.html?course=ap-calculus-bc', context: 'Mathematics' },
  { type: 'SANDBOX', title: 'C++ Sandbox', href: '/cpp-sandbox.html', context: 'Sandbox' },
  { type: 'APPLICATION', title: 'How Recommendation Engines Actually Work', href: '/Applications/how-recommendation-engines-work.html', context: 'Applications' },
];
const index = buildSearchIndex(catalog, seeds);
const chain = searchIndex(index, 'chain rule', 30);

assert.strictEqual(chain[0].type, 'LESSON');
assert.strictEqual(chain[0].title, 'The Chain Rule');
assert.ok(chain.some((entry) => entry.type === 'PRACTICE' && entry.context === 'Mathematics'));
assert.ok(chain.some((entry) => entry.type === 'COURSE' && entry.title === 'AP Calculus BC'));
assert.ok(chain.some((entry) => entry.type === 'SKILL' && entry.context.startsWith('AP Calculus BC')));
assert.strictEqual(searchIndex(index, 'c++')[0].title, 'C++ Sandbox');
assert.strictEqual(searchIndex(index, 'principal component', 30).find((entry) => entry.type === 'APPLICATION').label, 'RELATED');
assert.strictEqual(normalize('AI & Data'), 'ai and data');
assert.strictEqual(new Set(index.map((entry) => `${entry.type}|${entry.href}|${entry.title}`)).size, index.length);

console.log(`check-global-search: OK (${index.length} indexed results)`);
