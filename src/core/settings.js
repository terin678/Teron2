// Keybinds + option toggles, persisted to localStorage. Pure JS, no Phaser.
//
// A bind is a signature string:
//   'KeyW', 'Digit1', 'Tab', 'Escape'        -- KeyboardEvent.code (layout independent)
//   'Shift+Tab'                              -- shift-modified trigger
//   'Mouse3', 'Mouse4'                       -- extra mouse buttons (back/forward)

const STORAGE_KEY = 'teron2.settings';

// Bump when a default changes in a way that must override an existing saved
// value. v2: mouseover casting defaults off (see DEFAULT_SETTINGS).
const SETTINGS_VERSION = 2;

export const ACTION_DEFS = [
	{ id: 'moveUp', label: 'Move Up', group: 'movement' },
	{ id: 'moveLeft', label: 'Move Left', group: 'movement' },
	{ id: 'moveDown', label: 'Move Down', group: 'movement' },
	{ id: 'moveRight', label: 'Move Right', group: 'movement' },
	{ id: 'ability0', label: 'Spirit Strike', group: 'abilities' },
	{ id: 'ability1', label: 'Spirit Lance', group: 'abilities' },
	{ id: 'ability2', label: 'Spirit Chains', group: 'abilities' },
	{ id: 'ability3', label: 'Spirit Volley', group: 'abilities' },
	{ id: 'ability4', label: 'Spirit Shield', group: 'abilities' },
	{ id: 'targetNext', label: 'Target Next', group: 'targeting' },
	{ id: 'targetPrev', label: 'Target Previous', group: 'targeting' },
	{ id: 'targetNearest', label: 'Target Nearest', group: 'targeting' },
	{ id: 'pause', label: 'Pause', group: 'system' },
];

export const DEFAULT_SETTINGS = {
	binds: {
		moveUp: ['KeyW', 'ArrowUp'],
		moveLeft: ['KeyA', 'ArrowLeft'],
		moveDown: ['KeyS', 'ArrowDown'],
		moveRight: ['KeyD', 'ArrowRight'],
		ability0: ['Digit1', null],
		ability1: ['Digit3', null],
		ability2: ['Digit4', null],
		ability3: ['Digit5', null],
		ability4: ['Digit7', null],
		targetNext: ['Tab', null],
		targetPrev: ['Shift+Tab', null],
		targetNearest: ['KeyF', null],
		pause: ['Escape', null],
	},
	// Off by default: it silently redirects casts away from the ring-highlighted
	// target, which reads as broken targeting unless you deliberately want it.
	mouseoverCast: false,
	autoTargetNearest: true,
	abilityCoach: true,
	muted: false,
	version: SETTINGS_VERSION,
};

export function loadSettings() {
	let stored = null;
	try {
		stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
	} catch (e) { /* corrupted or unavailable -> defaults */ }

	const s = structuredClone(DEFAULT_SETTINGS);
	if (stored && typeof stored === 'object') {
		for (const k of ['mouseoverCast', 'autoTargetNearest', 'abilityCoach', 'muted']) {
			if (typeof stored[k] === 'boolean') s[k] = stored[k];
		}
		// v1 saved mouseoverCast: true for everyone. Force it back off once on
		// upgrade so existing players stop having casts stolen by the cursor;
		// they can turn it back on in Options if they actually want it.
		if ((Number(stored.version) || 1) < SETTINGS_VERSION) {
			s.mouseoverCast = DEFAULT_SETTINGS.mouseoverCast;
		}
		if (stored.binds && typeof stored.binds === 'object') {
			for (const action of Object.keys(s.binds)) {
				const b = stored.binds[action];
				if (Array.isArray(b)) {
					s.binds[action] = [b[0] ?? null, b[1] ?? null];
				}
			}
		}
	}
	return s;
}

export function saveSettings(settings) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch (e) { /* private mode etc. -- settings just won't persist */ }
}

// Signature for a DOM KeyboardEvent. Trigger actions distinguish Shift+X from X.
export function eventSig(e) {
	if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') return e.code;
	return (e.shiftKey ? 'Shift+' : '') + e.code;
}

export function bareCode(sig) {
	return sig ? sig.replace(/^Shift\+/, '') : sig;
}

// Find which action a signature triggers. Exact match wins; a shift-modified
// press falls back to the bare bind so Shift+1 still casts ability on '1'
// unless 'Shift+1' is explicitly bound elsewhere.
export function findAction(binds, sig) {
	for (const [action, list] of Object.entries(binds)) {
		if (list.includes(sig)) return action;
	}
	const bare = bareCode(sig);
	if (bare !== sig) {
		for (const [action, list] of Object.entries(binds)) {
			if (list.includes(bare)) return action;
		}
	}
	return null;
}

// Assign sig to binds[action][slot], stealing it from any other action.
// Returns the id of the action it was stolen from, or null.
export function assignBind(binds, action, slot, sig) {
	let stolenFrom = null;
	for (const [other, list] of Object.entries(binds)) {
		for (let i = 0; i < list.length; i++) {
			if (list[i] === sig && !(other === action && i === slot)) {
				list[i] = null;
				stolenFrom = other;
			}
		}
	}
	binds[action][slot] = sig;
	return stolenFrom;
}

const LABEL_MAP = {
	ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
	Escape: 'Esc', Space: 'Space', Tab: 'Tab', Backquote: '`', Minus: '-', Equal: '=',
	BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',',
	Period: '.', Slash: '/', Backslash: '\\', ShiftLeft: 'LShift', ShiftRight: 'RShift',
	ControlLeft: 'LCtrl', ControlRight: 'RCtrl', AltLeft: 'LAlt', AltRight: 'RAlt',
	Mouse3: 'M4', Mouse4: 'M5', Mouse1: 'M3',
};

export function bindLabel(sig) {
	if (!sig) return '-';
	const shift = sig.startsWith('Shift+');
	const code = bareCode(sig);
	let label;
	if (LABEL_MAP[code]) label = LABEL_MAP[code];
	else if (code.startsWith('Key')) label = code.slice(3);
	else if (code.startsWith('Digit')) label = code.slice(5);
	else if (code.startsWith('Numpad')) label = 'Num' + code.slice(6);
	else label = code;
	return (shift ? 'S-' : '') + label;
}
