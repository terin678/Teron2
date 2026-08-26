// Locks the ability data to the original game's values, so a future tweak to
// constants.js can't silently drift the fight away from the real encounter.
//
// Numbers are taken from Faldorn's original terongame source (AbilityBar.js /
// Ghost.js), which this project is a port of. The rotation-relevant facts are
// corroborated by Wowhead's Teron Gorefiend mechanic guide.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
	ABILITIES, GHOST, GCD_MS, PLAYER_SPEED, PX_PER_YARD, DIFFICULTIES, GHOST_NAMES,
} from '../src/core/constants.js';

const byId = Object.fromEntries(ABILITIES.map(a => [a.id, a]));

test('all five spirit abilities exist, on distinct bar slots', () => {
	assert.deepEqual(
		ABILITIES.map(a => a.id).sort(),
		['chains', 'lance', 'shield', 'strike', 'volley']
	);
	const slots = ABILITIES.map(a => a.slot);
	assert.equal(new Set(slots).size, slots.length, 'slots must be unique');
});

test('Spirit Volley: 12 yd AoE, 9900-12100, 15 sec cooldown', () => {
	const a = byId.volley;
	assert.equal(a.type, 'aoe');
	assert.equal(a.rangeYards, 12);
	assert.deepEqual(a.dmg, [9900, 12100]);
	assert.equal(a.cooldownMs, 15000);
});

test('Spirit Chains: 12 yd AoE, 1900-2100, 15 sec cooldown, freezes', () => {
	const a = byId.chains;
	assert.equal(a.type, 'aoe');
	assert.equal(a.rangeYards, 12);
	assert.deepEqual(a.dmg, [1900, 2100]);
	assert.equal(a.cooldownMs, 15000);
	assert.ok(a.freeze, 'Chains must apply the freeze');
});

test('Spirit Lance: 30 yd single target, 6175-6825, no cooldown, slows', () => {
	const a = byId.lance;
	assert.equal(a.type, 'target');
	assert.equal(a.rangeYards, 30);
	assert.deepEqual(a.dmg, [6175, 6825]);
	assert.equal(a.cooldownMs, 0, 'Lance is the filler, so it must be GCD-capped only');
	assert.ok(a.slow, 'Lance must apply the slow');
});

test('Spirit Strike: melee 6 yd, 638-862', () => {
	const a = byId.strike;
	assert.equal(a.type, 'target');
	assert.equal(a.rangeYards, 6);
	assert.deepEqual(a.dmg, [638, 862]);
});

test('Spirit Shield deals no damage and is flavour only', () => {
	const a = byId.shield;
	assert.equal(a.type, 'flavor');
	assert.equal(a.dmg, undefined);
});

test('only Chains freezes and only Lance slows', () => {
	assert.deepEqual(ABILITIES.filter(a => a.freeze).map(a => a.id), ['chains']);
	assert.deepEqual(ABILITIES.filter(a => a.slow).map(a => a.id), ['lance']);
});

test('constructs: four of them, 65,000 HP each', () => {
	assert.equal(GHOST_NAMES.length, 4);
	assert.equal(GHOST.maxHP, 65000);
});

test('freeze lasts 5 sec; the slow lasts 9 sec at 30% per stack, max 3', () => {
	assert.equal(GHOST.freezeMs, 5000);
	assert.equal(GHOST.lanceMs, 9000);
	assert.equal(GHOST.lanceSlowPerStack, 0.3);
	assert.equal(GHOST.maxLanceStacks, 3);
});

test('global cooldown is 1 second', () => {
	assert.equal(GCD_MS, 1000);
});

test('yard conversion follows the original 7 yards/sec movement speed', () => {
	assert.equal(PLAYER_SPEED, 90);
	assert.equal(PX_PER_YARD, PLAYER_SPEED / 7);
});

test('Volley and Chains share a radius, and Lance far outranges both', () => {
	assert.equal(byId.volley.rangeYards, byId.chains.rangeYards);
	assert.ok(byId.lance.rangeYards > byId.volley.rangeYards);
	assert.ok(byId.strike.rangeYards < byId.volley.rangeYards);
});

test('practice is easier than normal, and tutorial keeps no records', () => {
	assert.ok(DIFFICULTIES.practice.ghostSpeedMult < DIFFICULTIES.normal.ghostSpeedMult);
	assert.equal(DIFFICULTIES.normal.ghostSpeedMult, 1.0);
	assert.ok(DIFFICULTIES.tutorial.noRecords);
});
