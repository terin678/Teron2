import { saveSettings } from '../../core/settings.js';

export class SoundToggle extends Phaser.GameObjects.Image {

	constructor(scene, x, y) {
		const settings = scene.registry.get('settings');
		super(scene, x, y, settings.muted ? 'soundOff' : 'soundOn');
		this.setInteractive({ useHandCursor: true });
		scene.sound.mute = settings.muted;

		this.on('pointerdown', () => {
			settings.muted = !settings.muted;
			scene.sound.mute = settings.muted;
			this.setTexture(settings.muted ? 'soundOff' : 'soundOn');
			saveSettings(settings);
		});
	}
}
