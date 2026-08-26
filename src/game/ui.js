import { GAME_WIDTH } from '../core/constants.js';

let cachedScale = null;

// The game is authored against a fixed 600x800 canvas and Phaser letterboxes it
// to fit the screen. On a 375px-wide phone that is a 0.625x shrink, which
// rendered an 11px target-frame label at under 7px — unreadable. On touch
// devices we scale text by the inverse so it lands near its nominal size.
//
// Capped, because on a very narrow phone the raw inverse would blow layouts
// apart faster than it helps.
export function textScale(scene) {
	if (scene.sys.game.device.os.desktop) return 1;
	if (cachedScale !== null) return cachedScale;
	const width = scene.game.canvas.getBoundingClientRect().width;
	if (!width) return 1; // canvas not laid out yet; don't cache a bad value
	cachedScale = Math.min(1.75, Math.max(1, GAME_WIDTH / width));
	return cachedScale;
}

// Scaled font size as a Phaser style string: fs(this, 15.5) -> "25px" on mobile.
export function fs(scene, basePx) {
	return Math.round(basePx * textScale(scene)) + 'px';
}

export function isMobile(scene) {
	return !scene.sys.game.device.os.desktop;
}
