'use strict';

const assert = require('node:assert');
const catalog = require('../public/assets/skill-catalog.json');
const { buildSearchIndex, searchIndex, normalize } = require('../lib/global-search');

const seeds = [
  { type: 'COURSE', title: 'AP Calculus BC', href: '/AP%20STEM%2B/AP_CALC/index.html', context: 'Math' },
  { type: 'PRACTICE', title: 'AP Calculus BC', href: '/problem-set.html?course=ap-calculus-bc', context: 'Mathematics' },
  { type: 'SANDBOX', title: 'C++ Sandbox', href: '/cpp-sandbox.html', context: 'Sandbox' },
  { type: 'APPLICATION', title: 'How Recommendation Engines Actually Work', href: '/Applications/how-recommendation-engines-work.html', context: 'Applications' },
  { type: 'COURSE', title: 'AP Physics C: Mechanics', href: '/AP%20Physics%20C%20Mechanics/index.html', context: 'Science' },
  { type: 'APPLICATION', title: 'Keeping a Satellite in Orbit', href: '/Applications/keeping-a-satellite-in-orbit.html', context: 'Applications' },
  { type: 'COURSE', title: 'Computer Programming 1', href: '/Computer%20Programming%201/index.html', context: 'Technology', keywords: ['python'] },
  { type: 'SANDBOX', title: 'Python Sandbox', href: '/python-sandbox.html', context: 'Sandbox' },
  { type: 'PROJECT', title: 'Guided Programming Projects', href: '/python-projects.html', context: 'Projects', keywords: ['python'] },
  { type: 'PATHWAY', title: 'AI & Data', href: '/Pathways/ai-data.html', context: 'Pathways', keywords: ['ai engineer'] },
  { type: 'GOAL', title: 'Prepare for College STEM', href: '/Goals/prepare-for-college.html', context: 'Goals', keywords: ['ai engineer'] },
];
const index = buildSearchIndex(catalog, seeds);
const chain = searchIndex(index, 'chain rule', 30);

assert.strictEqual(chain[0].type, 'LESSON');
assert.strictEqual(chain[0].title, 'The Chain Rule');
assert.ok(chain.some((entry) => entry.type === 'PRACTICE' && entry.context === 'Mathematics'));
assert.ok(chain.some((entry) => entry.type === 'COURSE' && entry.title === 'AP Calculus BC'));
assert.ok(chain.some((entry) => entry.type === 'SKILL' && entry.context.startsWith('AP Calculus BC')));
assert.ok(chain.some((entry) => entry.type === 'SKILL' && entry.title === 'Chain Rule'));
assert.ok(chain.some((entry) => entry.type === 'PRACTICE' && entry.href.includes('skill=ap-calculus-bc.chain-rule')));
assert.strictEqual(searchIndex(index, 'c++')[0].title, 'C++ Sandbox');
assert.strictEqual(searchIndex(index, 'principal component', 30).find((entry) => entry.type === 'APPLICATION').label, 'RELATED');
const typo = searchIndex(index, 'derivitives', 30);
assert.ok(typo.some((entry) => /derivative/i.test(entry.title)), 'misspelled derivatives should find derivative lessons');
assert.strictEqual(typo[0].correctedQuery, 'derivatives');
const satellite = searchIndex(index, 'satellite', 60);
assert.ok(satellite.some((entry) => entry.type === 'APPLICATION'));
assert.ok(satellite.some((entry) => entry.type === 'COURSE' && entry.title === 'AP Physics C: Mechanics'));
const python = searchIndex(index, 'python', 60);
['COURSE', 'SANDBOX', 'PROJECT'].forEach((type) => assert.ok(python.some((entry) => entry.type === type), `python search is missing ${type}`));
const aiEngineer = searchIndex(index, 'AI engineer', 60);
assert.ok(aiEngineer.some((entry) => entry.type === 'PATHWAY' && entry.title === 'AI & Data'));
assert.ok(aiEngineer.some((entry) => entry.type === 'GOAL'));
assert.strictEqual(normalize('AI & Data'), 'ai and data');
assert.strictEqual(new Set(index.map((entry) => `${entry.type}|${entry.href}|${entry.title}`)).size, index.length);

console.log(`check-global-search: OK (${index.length} indexed results)`);
