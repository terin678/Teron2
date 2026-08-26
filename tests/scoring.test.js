// Locks the win-time colour grading to the original game's WoW-parse scale.
//
// The original's WinOverlay.js grades the time with a comment reading
// "Theoretically perfect = 27 seconds ... I think?" — which independently
// corroborates the ~28s mechanical floor (4 constructs x 65,000 HP, cleared by
// 2 Spirit Volleys + 2 Spirit Chains of AoE plus 24 Spirit Lance GCDs).

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTier, formatTime } from '../src/core/records.js';

test('a near-perfect clear grades gold', () => {
	assert.equal(parseTier(27).label, 'gold');
	assert.equal(parseTier(28).label, 'gold');
	assert.equal(parseTier(28).color, '#e5cc5e');
});

test('the scale steps gold -> pink -> orange -> purple -> blue -> green -> grey', () => {
	assert.deepEqual(
		[28, 29, 30, 32, 35, 40, 41].map(s => parseTier(s).label),
		['gold', 'pink', 'orange', 'purple', 'blue', 'green', 'grey']
	);
});

test('tier boundaries are inclusive, matching the original', () => {
	assert.equal(parseTier(29).label, 'pink');
	assert.equal(parseTier(29.01).label, 'orange');
	assert.equal(parseTier(35).label, 'blue');
	assert.equal(parseTier(35.01).label, 'green');
});

test('anything slower than 40 seconds is a grey parse', () => {
	assert.equal(parseTier(40.01).label, 'grey');
	assert.equal(parseTier(999).label, 'grey');
	assert.equal(parseTier(Infinity).label, 'grey');
});

test('every tier exposes a valid hex colour', () => {
	for (const s of [27, 28.5, 29.5, 31, 34, 38, 60]) {
		assert.match(parseTier(s).color, /^#[0-9a-f]{6}$/, `bad colour at ${s}s`);
	}
});

test('grading is monotonic — a faster time never grades worse', () => {
	const order = ['gold', 'pink', 'orange', 'purple', 'blue', 'green', 'grey'];
	let last = -1;
	for (let s = 20; s <= 60; s += 0.5) {
		const rank = order.indexOf(parseTier(s).label);
		assert.ok(rank >= last, `grading went backwards at ${s}s`);
		last = rank;
	}
});

test('times render to two decimal places with a unit', () => {
	assert.equal(formatTime(30.909), '30.91s');
	assert.equal(formatTime(7), '7.00s');
});
