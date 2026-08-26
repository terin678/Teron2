// Locks the tutorial to teaching the published rotation, in order.
//
// Regression guarded here: the tutorial originally taught Chains FIRST and then
// Volley, which throws the freeze away (Volley is AoE and any damage breaks the
// freeze), and it taught Spirit Strike as a filler even though the guide says to
// leave Strike and Shield alone until the constructs are down.

import test from 'node:test';
import assert from 'node:assert/strict';
import { TUTORIAL_STEPS, OFF_ROTATION_ABILITIES } from '../src/core/tutorial.js';
import { ABILITIES } from '../src/core/constants.js';

const SLOT = Object.fromEntries(ABILITIES.map(a => [a.id, a.slot]));
const taught = TUTORIAL_STEPS.filter(s => s.ability).map(s => s.ability);

test('it opens by teaching target selection', () => {
	assert.equal(TUTORIAL_STEPS[0].id, 'target');
	assert.equal(TUTORIAL_STEPS[0].event, 'target-selected');
});

test('it teaches exactly Volley -> Chains -> Lance, in that order', () => {
	assert.deepEqual(taught, ['volley', 'chains', 'lance']);
});

test('Volley is taught before Chains, so the freeze is not wasted', () => {
	assert.ok(taught.indexOf('volley') < taught.indexOf('chains'));
});

test('it never teaches Strike or Shield during the construct phase', () => {
	for (const off of OFF_ROTATION_ABILITIES) {
		assert.ok(!taught.includes(off), `tutorial should not teach ${off}`);
	}
});

test('each step glows the bar slot for the ability it is teaching', () => {
	for (const step of TUTORIAL_STEPS) {
		if (!step.ability) continue;
		assert.equal(step.slot, SLOT[step.ability], `${step.ability} glow points at the wrong slot`);
	}
});

test('the targeting step glows nothing', () => {
	assert.equal(TUTORIAL_STEPS[0].slot, -1);
});

test('every ability step waits on an actual cast before advancing', () => {
	for (const step of TUTORIAL_STEPS.slice(1)) {
		assert.equal(step.event, 'ability-cast');
	}
});

test('step ids are unique', () => {
	const ids = TUTORIAL_STEPS.map(s => s.id);
	assert.equal(new Set(ids).size, ids.length);
});
