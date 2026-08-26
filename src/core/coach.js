// Rotation coach ("training wheels"): recommends the next ability to press.
//
// Priority is the standard construct-phase rotation:
//   1. Spirit Volley - off cooldown
//   2. Spirit Chains - off cooldown
//   3. Spirit Lance  - filler on every construct, swapping target after each cast
//
// Spirit Strike and Spirit Shield are deliberately absent: they are not part of
// the construct rotation and are saved for after the constructs are down.
//
// Volley has to come before Chains. It is AoE, so casting it after a Chains
// would break the freeze on the entire pack. Lance is single-target, so it only
// breaks the freeze on the one construct it hits.
//
// Pure logic, shared by the 2D and 3D front-ends.

import { PX_PER_YARD } from './constants.js';

// state = {
//   player: {x, y},
//   ghosts: [{x, y, lanceStacks, lanceRemainMs}, ...]   (alive ghosts only)
//   targetIndex: index into ghosts, or -1
//   ready: [bool x5]  (ability off cooldown; GCD is ignored so the hint is stable)
// }
// Returns the recommended slot index 0-4, or -1 for "nothing / reposition".
export function recommendSlot({ player, ghosts, targetIndex, ready }) {
	if (!ghosts.length) return -1;

	const dist = g => Math.hypot(g.x - player.x, g.y - player.y);
	const within = (g, yards) => dist(g) <= yards * PX_PER_YARD;
	const near12 = ghosts.filter(g => within(g, 12));

	let focus = targetIndex >= 0 && targetIndex < ghosts.length ? ghosts[targetIndex] : null;
	if (!focus) focus = ghosts.reduce((a, b) => (dist(a) <= dist(b) ? a : b));

	if (ready[3] && near12.length) return 3; // Spirit Volley
	if (ready[2] && near12.length) return 2; // Spirit Chains
	if (ready[1] && within(focus, 30)) return 1; // Spirit Lance
	return -1;
}
