// Locks the tab-targeting behaviour the original game got wrong: it cycled
// constructs in fixed spawn-array order regardless of where they were on screen,
// which is what made targeting feel random.
//
// Ours: Tab takes the nearest and walks outward; Shift-Tab takes the furthest
// and walks inward.

import test from 'node:test';
import assert from 'node:assert/strict';
import { TabCycler, nearest, sortByDistance } from '../src/core/targeting.js';

const P = { x: 0, y: 0 };
// Deliberately out of distance order, mimicking a spawn array.
const near = { id: 'near', x: 10, y: 0 };
const mid = { id: 'mid', x: 50, y: 0 };
const far = { id: 'far', x: 120, y: 0 };
const farthest = { id: 'farthest', x: 300, y: 0 };
const ALL = [far, near, farthest, mid];

test('nearest() ignores array order and uses distance', () => {
	assert.equal(nearest(ALL, P), near);
	assert.equal(nearest([], P), null);
});

test('sortByDistance orders nearest to farthest without mutating input', () => {
	const copy = [...ALL];
	assert.deepEqual(sortByDistance(ALL, P).map(g => g.id), ['near', 'mid', 'far', 'farthest']);
	assert.deepEqual(ALL, copy, 'input array must not be mutated');
});

test('Tab with nothing selected picks the nearest construct', () => {
	const c = new TabCycler();
	assert.equal(c.next(ALL, P, null), near);
});

test('repeated Tab walks outward through every construct', () => {
	const c = new TabCycler();
	const order = [];
	let current = null;
	for (let i = 0; i < ALL.length; i++) {
		current = c.next(ALL, P, current);
		order.push(current.id);
	}
	assert.deepEqual(order, ['near', 'mid', 'far', 'farthest']);
});

test('Tab wraps back around to the nearest after the last one', () => {
	const c = new TabCycler();
	let current = null;
	for (let i = 0; i < ALL.length; i++) current = c.next(ALL, P, current);
	assert.equal(c.next(ALL, P, current), near, 'should wrap to nearest');
});

test('Shift-Tab with nothing selected picks the furthest construct', () => {
	const c = new TabCycler();
	assert.equal(c.prev(ALL, P, null), farthest);
});

test('repeated Shift-Tab walks inward', () => {
	const c = new TabCycler();
	const order = [];
	let current = null;
	for (let i = 0; i < ALL.length; i++) {
		current = c.prev(ALL, P, current);
		order.push(current.id);
	}
	assert.deepEqual(order, ['farthest', 'far', 'mid', 'near']);
});

test('the cycle rebuilds when a construct dies mid-rotation', () => {
	const c = new TabCycler();
	let current = c.next(ALL, P, null);
	assert.equal(current, near);
	// 'mid' dies; the remaining set must still cycle sensibly.
	const alive = [far, near, farthest];
	current = c.next(alive, P, current);
	assert.ok(alive.includes(current));
	assert.notEqual(current, near, 'should advance off the current target');
});

test('targeting a construct that is no longer alive restarts from nearest', () => {
	const c = new TabCycler();
	const dead = { id: 'dead', x: 5, y: 0 };
	assert.equal(c.next(ALL, P, dead), near);
});

test('no constructs means no target', () => {
	const c = new TabCycler();
	assert.equal(c.next([], P, null), null);
	assert.equal(c.prev([], P, null), null);
});

test('a single construct is returned by both directions', () => {
	const c = new TabCycler();
	assert.equal(c.next([near], P, null), near);
	assert.equal(c.prev([near], P, null), near);
});
