// The construct-phase rotation the tutorial teaches, as pure data so it can be
// asserted against in tests. The scene supplies the on-screen wording.
//
// Source of truth — Wowhead's Teron Gorefiend mechanic guide:
//
//   "Your rotation will be:
//      Spirit Volley off cooldown
//      Spirit Chains off cooldown
//      Spirit Lance all constructs, swapping each target after casting one"
//
//   "Don't worry about Spirit Strike or Spirit Shield until after the
//    constructs are defeated."
//
// Order matters beyond the guide, too: Volley is AoE, so casting it after a
// Chains would break the freeze on the whole pack. Lance is single-target and
// only breaks the freeze on the construct it hits.

export const TUTORIAL_STEPS = [
	{ id: 'target', event: 'target-selected', ability: null, slot: -1 },
	{ id: 'volley', event: 'ability-cast', ability: 'volley', slot: 3 },
	{ id: 'chains', event: 'ability-cast', ability: 'chains', slot: 2 },
	{ id: 'lance', event: 'ability-cast', ability: 'lance', slot: 1 },
];

// Explicitly not part of the construct rotation — saved for after they're down.
export const OFF_ROTATION_ABILITIES = ['strike', 'shield'];
