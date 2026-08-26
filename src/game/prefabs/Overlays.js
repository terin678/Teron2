import { formatTime } from '../../core/records.js';

function makeButton(scene, container, x, y, label, scale, onClick) {
	const image = scene.add.image(x, y, 'buttons', 2).setScale(scale);
	image.setInteractive({ useHandCursor: true });
	const text = scene.add.text(x, y - 4, label, {
		align: 'center', fontSize: '28px', strokeThickness: 3,
	}).setOrigin(0.5, 0.5);
	image.on('pointerover', () => text.setTint(0xf6e91f));
	image.on('pointerout', () => text.clearTint());
	image.on('pointerdown', onClick);
	container.add([image, text]);
	return image;
}

export class WinOverlay extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x, y);
		this.visible = false;

		const backdrop = scene.add.rectangle(0, 60, 520, 400, 0x000000, 0.8);
		backdrop.setStrokeStyle(2, 0xc9a227);
		this.add(backdrop);

		this.title = scene.add.text(0, -80, 'Teron Gorefiend dies!', {
			align: 'center', color: '#f6d21f', fontSize: '34px', fontStyle: 'bold',
			stroke: '#000000', strokeThickness: 4, wordWrap: { width: 480 },
		}).setOrigin(0.5, 0.5);
		this.add(this.title);

		this.timeText = scene.add.text(0, -20, '', {
			align: 'center', fontSize: '24px', wordWrap: { width: 480 },
		}).setOrigin(0.5, 0.5);
		this.add(this.timeText);

		this.bestText = scene.add.text(0, 20, '', {
			align: 'center', color: '#bbbbbb', fontSize: '18px', wordWrap: { width: 480 },
		}).setOrigin(0.5, 0.5);
		this.add(this.bestText);

		this.recordText = scene.add.text(0, 60, 'NEW RECORD!', {
			align: 'center', color: '#3ef06c', fontSize: '28px', fontStyle: 'bold',
		}).setOrigin(0.5, 0.5);
		this.add(this.recordText);

		makeButton(scene, this, 0, 130, 'RESTART', 0.22, () => scene.restartGame());
		makeButton(scene, this, 0, 200, 'MENU', 0.16, () => scene.returnToMenu());

		this.hint = scene.add.text(0, 250, 'Press R to restart', {
			align: 'center', color: '#999999', fontSize: '16px',
		}).setOrigin(0.5, 0.5);
		this.add(this.hint);
	}

	show(seconds, { best, isRecord, cheated, noRecords }) {
		this.timeText.setText('Constructs destroyed in ' + formatTime(seconds));
		if (cheated) {
			this.bestText.setText('(cheats enabled — time not recorded)');
			this.recordText.visible = false;
		} else if (noRecords) {
			this.bestText.setText('Tutorial complete! Try Practice or Normal next.');
			this.recordText.visible = false;
		} else {
			this.bestText.setText('Personal best: ' + formatTime(best));
			this.recordText.visible = isRecord;
		}
		this.visible = true;
		this.alpha = 0;
		this.scene.tweens.add({ targets: this, alpha: 1, duration: 800, ease: 'Power2' });
	}
}

export class LoseOverlay extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x, y);
		this.visible = false;

		const backdrop = scene.add.rectangle(0, 30, 520, 340, 0x000000, 0.8);
		backdrop.setStrokeStyle(2, 0x8a1010);
		this.add(backdrop);

		this.add(scene.add.text(0, -70, 'A construct reached Teron!', {
			align: 'center', color: '#ff5555', fontSize: '26px', fontStyle: 'bold',
			stroke: '#000000', strokeThickness: 4, wordWrap: { width: 480 },
		}).setOrigin(0.5, 0.5));

		this.add(scene.add.text(0, -20, 'Your raid wipes... again.', {
			align: 'center', fontSize: '20px', wordWrap: { width: 480 },
		}).setOrigin(0.5, 0.5));

		makeButton(scene, this, 0, 60, 'RETRY', 0.22, () => scene.restartGame());
		makeButton(scene, this, 0, 130, 'MENU', 0.16, () => scene.returnToMenu());

		this.add(scene.add.text(0, 180, 'Press R to retry', {
			align: 'center', color: '#999999', fontSize: '16px',
		}).setOrigin(0.5, 0.5));
	}

	show() {
		this.visible = true;
		this.alpha = 0;
		this.scene.tweens.add({ targets: this, alpha: 1, duration: 800, ease: 'Power2' });
	}
}
