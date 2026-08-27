import { findAction } from '../../core/settings.js';

export class Pause extends Phaser.Scene {

	constructor() {
		super('Pause');
	}

	create() {
		this.scene.bringToTop();
		this.settings = this.registry.get('settings');

		const blocker = this.add.rectangle(300, 400, 600, 800, 0x000000, 0.6);
		blocker.setInteractive();

		this.add.text(300, 260, 'PAUSED', {
			fontSize: '48px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
		}).setOrigin(0.5, 0.5);

		this.makeButton(340, 'Resume', () => this.resumeGame());
		this.makeButton(400, 'Options', () => this.scene.launch('Options', { from: 'Pause' }));
		this.makeButton(460, 'Restart', () => {
			this.scene.stop();
			const game = this.scene.get('TeronGame');
			this.scene.resume('TeronGame');
			game.restartGame();
		});
		this.makeButton(520, 'Main Menu', () => {
			this.scene.stop();
			const game = this.scene.get('TeronGame');
			this.scene.resume('TeronGame');
			game.returnToMenu();
		});

		this.add.text(300, 580, 'Esc to resume', {
			color: '#999999', fontSize: '16px',
		}).setOrigin(0.5, 0.5);

		this.input.keyboard.on('keydown', e => {
			if (e.repeat || this.scene.isActive('Options')) return;
			const sig = (e.shiftKey && e.code !== 'ShiftLeft' && e.code !== 'ShiftRight' ? 'Shift+' : '') + e.code;
			if (e.code === 'Escape' || findAction(this.settings.binds, sig) === 'pause') {
				e.preventDefault();
				this.resumeGame();
			}
		});

		// Same as elsewhere: the scene emitter outlives a stop/launch cycle, so
		// drop our previous handler before adding a fresh one.
		this.events.off('options-closed');
		this.events.on('options-closed', () => {
			this.scene.get('TeronGame')?.events.emit('binds-changed');
		});
	}

	makeButton(y, label, onClick) {
		const text = this.add.text(300, y, label, {
			backgroundColor: '#1c2c3c', fontSize: '22px', padding: { x: 22, y: 10 },
		}).setOrigin(0.5, 0.5);
		text.setInteractive({ useHandCursor: true });
		text.on('pointerover', () => text.setTint(0xf6e91f));
		text.on('pointerout', () => text.clearTint());
		text.on('pointerdown', onClick);
	}

	resumeGame() {
		this.scene.stop();
		this.scene.resume('TeronGame');
	}
}
