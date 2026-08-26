// All gameplay tuning, taken exactly from the original terongame source.
// Pure data — no Phaser dependencies, so a future 3D front-end can reuse it.

export const GAME_WIDTH = 600;
export const GAME_HEIGHT = 800;

export const BOSS_POS = { x: 300, y: 150 };
export const DOORWAY_POS = { x: 300, y: 310 };
export const BOSS_LOSE_RANGE = 20;

// Corridor: once a ghost is here it heads straight for the boss.
export const CORRIDOR = { minX: 240, maxX: 360, maxY: 270 };

export const PLAYER_SPEED = 90; // px/s == 7 yards/s in WoW terms
export const PX_PER_YARD = PLAYER_SPEED / 7.0;

export const GHOST = {
	maxHP: 65000,
	speed: 45,
	spawnGraceMs: 1000,
	freezeMs: 5000,
	lanceMs: 9000,
	lanceSlowPerStack: 0.3,
	maxLanceStacks: 3,
	spawnOffset: 20,
};

export const GCD_MS = 1000;

export const DIFFICULTIES = {
	normal: {
		id: 'normal',
		label: 'Normal',
		ghostSpeedMult: 1.0,
		firstPrepSeconds: 13,
		retryPrepSeconds: 10,
		hints: false,
	},
	practice: {
		id: 'practice',
		label: 'Practice',
		ghostSpeedMult: 0.6,
		firstPrepSeconds: 20,
		retryPrepSeconds: 12,
		hints: true,
	},
	tutorial: {
		id: 'tutorial',
		label: 'Tutorial',
		ghostSpeedMult: 0.6,
		firstPrepSeconds: 10,
		retryPrepSeconds: 8,
		hints: false,
		tutorial: true,
		noRecords: true,
	},
};

// slot order matches the original possess bar (defaults 1 / 3 / 4 / 5 / 7)
export const ABILITIES = [
	{
		id: 'strike', slot: 0, name: 'Spirit Strike', icon: 'spell_spiritStrike',
		type: 'target', rangeYards: 6, dmg: [638, 862], projSpeed: 300,
		cooldownMs: 0, castSound: 'spiritStrike_Cast', impactSound: 'spiritStrike_Impact',
		desc: 'Melee range. Strikes your target for 638-862 damage. Not part of the construct rotation — save it for after they are down.',
	},
	{
		id: 'lance', slot: 1, name: 'Spirit Lance', icon: 'spell_spiritLance',
		type: 'target', rangeYards: 30, dmg: [6175, 6825], projSpeed: 600,
		cooldownMs: 0, castSound: 'spiritLance_Cast', impactSound: 'spiritLance_Impact',
		lanceFx: true, slow: true,
		desc: '30 yd range. 6175-6825 damage and slows the target 30% per stack (max 3) for 9 sec. Filler: lance all four, swapping target after each cast.',
	},
	{
		id: 'chains', slot: 2, name: 'Spirit Chains', icon: 'spell_spiritChains',
		type: 'aoe', rangeYards: 12, dmg: [1900, 2100], projSpeed: 300,
		cooldownMs: 15000, castSound: 'spiritChains_Cast', impactSound: 'spiritChains_Impact',
		freeze: true, nova: true,
		desc: '12 yd around you. 1900-2100 damage and freezes constructs in place for 5 sec. Damage breaks the freeze. 15 sec cooldown.',
	},
	{
		id: 'volley', slot: 3, name: 'Spirit Volley', icon: 'spell_spiritVolley',
		type: 'aoe', rangeYards: 12, dmg: [9900, 12100], projSpeed: 400,
		cooldownMs: 15000, castSound: 'spiritVolley_Cast', impactSound: 'spiritVolley_Impact',
		lanceFx: true,
		desc: '12 yd around you. Blasts all nearby constructs for 9900-12100 damage. 15 sec cooldown.',
	},
	{
		id: 'shield', slot: 4, name: 'Spirit Shield', icon: 'spell_spiritShield',
		type: 'flavor', cooldownMs: 0,
		desc: 'Absorbs damage. Not needed while the constructs are up — the constructs deal none anyway.',
	},
];

// Arena collision rectangles [x, y, w, h] (centers), from the original editor layout.
export const WALLS = [
	[137, 243, 128, 128], [216, 291, 32, 32], [216, 259, 32, 32], [197, 234, 32, 32],
	[39, 506, 50, 550], [134, 782, 128, 40], [194, 791, 32, 32], [406, 789, 32, 32],
	[556, 523, 50, 550], [470, 243, 128, 128], [487, 784, 128, 40], [391, 291, 32, 32],
	[391, 260, 32, 32], [409, 238, 32, 32], [470, 119, 128, 128], [137, 118, 128, 128],
	[299, 30, 256, 48], [202, 57, 48, 48], [408, 61, 48, 48], [385, 53, 32, 32],
	[413, 82, 32, 32], [230, 49, 32, 32], [191, 222, 32, 32], [207, 252, 32, 32],
	[199, 78, 32, 32], [367, 44, 32, 32], [402, 250, 32, 32], [415, 229, 32, 32],
];

// Decorative dots (dead raid members) in the boss room: [x, y, color]
export const DECOR_DOTS = [
	[320, 185, 0xf1e032], [307, 121, 0x815325], [345, 169, 0x815325], [281, 188, 0x2f27e5],
	[391, 149, 0x2f27e5], [277, 171, 0xf25b0d], [273, 75, 0xf25b0d], [329, 171, 0xf563e8],
	[391, 127, 0xf563e8], [264, 183, 0xf563e8], [223, 103, 0x4abafa], [374, 98, 0x4abafa],
	[241, 131, 0xa233f0], [217, 163, 0xa233f0], [353, 79, 0xa233f0], [351, 112, 0xa233f0],
	[218, 124, 0xffffff], [331, 73, 0xffffff], [245, 83, 0x3ec42c], [291, 67, 0x3ec42c],
	[244, 107, 0x3ec42c], [218, 144, 0x2f27e5], [311, 69, 0x2f27e5], [338, 184, 0x2f27e5],
	[391, 170, 0xffffff],
];

export const GHOST_NAMES = [
	'Deadly Construct 1', 'Deadly Construct 2', 'Deadly Construct 3', 'Deadly Construct 4',
];

export const CHEATS = {
	noLose: 'iddqd',
	noCooldowns: 'idkfa',
};
