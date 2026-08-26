// Locks the ability coach to the published construct-phase rotation.
//
// Source — Wowhead, "Practice Teron Gorefiend's Mechanics With This Flash Game":
//
//   "Your rotation will be:
//      Spirit Volley off cooldown
//      Spirit Chains off cooldown
//      Spirit Lance all constructs, swapping each target after casting one"
//
//   "Don't worry about Spirit Strike or Spirit Shield until after the
//    constructs are defeated."
//
// Regression guarded here: the coach previously recommended Chains BEFORE
// Volley, and later recommended Lance instead of Chains straight after a Volley.

import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendSlot } from '../src/core/coach.js';
import { ABILITIES } from '../src/core/constants.js';

const SLOT = Object.fromEntries(ABILITIES.map(a => [a.id, a.slot]));
const ALL_READY = [true, true, true, true, true];

// Four constructs stacked on the player, as they are right after spawning.
const PLAYER = { x: 300, y: 400 };
const PACK = [
	{ x: 300, y: 400, lanceStacks: 0, lanceRemainMs: 0 },
	{ x: 308, y: 402, lanceStacks: 0, lanceRemainMs: 0 },
	{ x: 312, y: 408, lanceStacks: 0, lanceRemainMs: 0 },
	{ x: 298, y: 412, lanceStacks: 0, lanceRemainMs: 0 },
];

const advise = (ghosts, ready, targetIndex = 0) =>
	recommendSlot({ player: PLAYER, ghosts, targetIndex, ready });

// ready[] with the named abilities forced onto cooldown
function readyExcept(...onCooldown) {
	const ready = [...ALL_READY];
	for (const id of onCooldown) ready[SLOT[id]] = false;
	return ready;
}

test('Spirit Volley leads when everything is off cooldown', () => {
	assert.equal(advise(PACK, ALL_READY), SLOT.volley);
});

test('Spirit Chains comes immediately after Volley, not Lance', () => {
	// The exact regression the user reported: it was advising Lance here.
	assert.equal(advise(PACK, readyExcept('volley')), SLOT.chains);
});

test('Spirit Lance fills once Volley and Chains are both on cooldown', () => {
	assert.equal(advise(PACK, readyExcept('volley', 'chains')), SLOT.lance);
});

test('a full rotation cycle reads Volley -> Chains -> Lance', () => {
	const sequence = [
		advise(PACK, ALL_READY),
		advise(PACK, readyExcept('volley')),
		advise(PACK, readyExcept('volley', 'chains')),
	];
	assert.deepEqual(sequence, [SLOT.volley, SLOT.chains, SLOT.lance]);
});

test('Spirit Strike is never part of the construct rotation', () => {
	// "Don't worry about Spirit Strike ... until after the constructs are defeated."
	const everyState = [
		advise(PACK, ALL_READY),
		advise(PACK, readyExcept('volley')),
		advise(PACK, readyExcept('volley', 'chains')),
		advise(PACK, readyExcept('volley', 'chains', 'lance')),
		advise([PACK[0]], ALL_READY),
	];
	assert.ok(!everyState.includes(SLOT.strike), `Strike was recommended: ${everyState}`);
});

test('Spirit Shield is never part of the construct rotation', () => {
	const everyState = [
		advise(PACK, ALL_READY),
		advise(PACK, readyExcept('volley')),
		advise(PACK, readyExcept('volley', 'chains')),
		advise(PACK, readyExcept('volley', 'chains', 'lance')),
	];
	assert.ok(!everyState.includes(SLOT.shield), `Shield was recommended: ${everyState}`);
});

test('nothing is recommended when only Strike and Shield remain', () => {
	assert.equal(advise(PACK, readyExcept('volley', 'chains', 'lance')), -1);
});

test('no advice without any constructs alive', () => {
	assert.equal(advise([], ALL_READY), -1);
});

test('AoE is skipped when the pack is out of its 12 yd radius', () => {
	// Constructs far away: Volley/Chains cannot reach, Lance (30 yd) still can.
	const far = [{ x: 300, y: 620, lanceStacks: 0, lanceRemainMs: 0 }];
	assert.equal(advise(far, ALL_READY), SLOT.lance);
});

test('falls through to no advice when everything is out of range', () => {
	const veryFar = [{ x: 300, y: 10000, lanceStacks: 0, lanceRemainMs: 0 }];
	assert.equal(advise(veryFar, ALL_READY), -1);
});
