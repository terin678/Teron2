import { GAME_WIDTH, GAME_HEIGHT } from '../core/constants.js';
import { loadSettings } from '../core/settings.js';
import { Preload } from './scenes/Preload.js';
import { Menu } from './scenes/Menu.js';
import { Options } from './scenes/Options.js';
import { Pause } from './scenes/Pause.js';
import { TeronGame } from './scenes/TeronGame.js';

// No browser context menu mid-fight, and no back/forward navigation from
// mouse buttons 4/5 (bindable as ability keys).
document.addEventListener('contextmenu', e => e.preventDefault());
for (const type of ['mousedown', 'mouseup', 'auxclick']) {
	document.addEventListener(type, e => {
		if (e.button === 3 || e.button === 4) e.preventDefault();
	});
}

window.addEventListener('load', () => {
	const game = new Phaser.Game({
		width: GAME_WIDTH,
		height: GAME_HEIGHT,
		type: Phaser.AUTO,
		backgroundColor: '#242424',
		disableContextMenu: true,
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
		},
		physics: {
			default: 'arcade',
			arcade: { debug: false },
		},
		input: {
			// so back/forward mouse buttons reach the game
			mouse: { preventDefaultDown: true, preventDefaultUp: true },
		},
	});

	window.game = game; // debugging convenience
	game.registry.set('settings', loadSettings());

	// Order matters: later scenes render on top, so overlay scenes come last.
	game.scene.add('Preload', Preload);
	game.scene.add('Menu', Menu);
	game.scene.add('TeronGame', TeronGame);
	game.scene.add('Pause', Pause);
	game.scene.add('Options', Options);
	game.scene.start('Preload');
});
