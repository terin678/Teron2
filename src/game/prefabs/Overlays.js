import { formatTime, parseTier } from '../../core/records.js';

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

		const backdrop = scene.add.rectangle(0, 70, 540, 440, 0x000000, 0.8);
		backdrop.setStrokeStyle(2, 0xc9a227);
		this.add(backdrop);

		// Wording from the original: you defend Teron from the constructs, you
		// don't kill him.
		this.title = scene.add.text(0, -110, 'All constructs defeated!', {
			align: 'center', color: '#6b74ff', fontSize: '30px', fontStyle: 'bold',
			stroke: '#000000', strokeThickness: 5, wordWrap: { width: 500 },
		}).setOrigin(0.5, 0.5);
		this.add(this.title);

		this.flavour = scene.add.text(0, -58, 'Your raid members cheer at you!\nYou saved their day!', {
			align: 'center', color: '#dfe2ff', fontSize: '20px', fontStyle: 'bold',
			stroke: '#000000', strokeThickness: 4, wordWrap: { width: 500 },
		}).setOrigin(0.5, 0.5);
		this.flavour.setLineSpacing(4);
		this.add(this.flavour);

		// Colour-graded by time, WoW parse style, exactly as the original does.
		this.timeText = scene.add.text(0, 10, '', {
			align: 'center', fontSize: '17px', fontStyle: 'bold',
			stroke: '#000000', strokeThickness: 5, wordWrap: { width: 500 },
		}).setOrigin(0.5, 0.5);
		this.add(this.timeText);

		this.cheatText = scene.add.text(0, 42, 'BUT YOU CHEATED!', {
			align: 'center', color: '#ad0d0d', fontSize: '26px', fontStyle: 'bold',
			stroke: '#000000', strokeThickness: 5,
		}).setOrigin(0.5, 0.5);
		this.add(this.cheatText);

		this.bestText = scene.add.text(0, 45, '', {
			align: 'center', color: '#bbbbbb', fontSize: '16px', wordWrap: { width: 500 },
		}).setOrigin(0.5, 0.5);
		this.add(this.bestText);

		this.recordText = scene.add.text(0, 75, 'NEW RECORD!', {
			align: 'center', color: '#3ef06c', fontSize: '24px', fontStyle: 'bold',
			stroke: '#000000', strokeThickness: 4,
		}).setOrigin(0.5, 0.5);
		this.add(this.recordText);

		makeButton(scene, this, 0, 140, 'PLAY AGAIN', 0.24, () => scene.restartGame());
		makeButton(scene, this, 0, 208, 'MENU', 0.16, () => scene.returnToMenu());

		this.hint = scene.add.text(0, 256, 'Press R to play again', {
			align: 'center', color: '#999999', fontSize: '16px',
		}).setOrigin(0.5, 0.5);
		this.add(this.hint);
	}

	show(seconds, { best, isRecord, cheated, noRecords }) {
		if (cheated) {
			// The original greys a cheated time out and calls it what it is.
			this.timeText.setText('You "won" in ' + formatTime(seconds) + '...');
			this.timeText.setColor('#666666');
			this.cheatText.visible = true;
			this.bestText.visible = false;
			this.recordText.visible = false;
		} else {
			this.timeText.setText('You won in ' + formatTime(seconds) + '! Can you beat your friends?');
			this.timeText.setColor(parseTier(seconds).color);
			this.cheatText.visible = false;
			this.bestText.visible = true;
			if (noRecords) {
				this.bestText.setText('Tutorial complete! Try Practice or Normal next.');
				this.recordText.visible = false;
			} else {
				this.bestText.setText('Personal best: ' + formatTime(best));
				this.recordText.visible = isRecord;
			}
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

		const backdrop = scene.add.rectangle(0, 40, 540, 400, 0x000000, 0.8);
		backdrop.setStrokeStyle(2, 0x8a1010);
		this.add(backdrop);

		this.add(scene.add.text(0, -110, 'Your raid leader audibly sighs...', {
			align: 'center', color: '#fb3333', fontSize: '25px', fontStyle: 'bold',
			stroke: '#000000', strokeThickness: 5, wordWrap: { width: 500 },
		}).setOrigin(0.5, 0.5));

		const body = scene.add.text(0, -30,
			"Ok wipe it up. This isn't hard just.. ugh. Didn't you all practice this? " +
			"Run back asap and let's hope you-know-who doesn't get Shadow of Death this time..", {
			align: 'center', color: '#fb8b8b', fontSize: '17px', fontStyle: 'bold',
			stroke: '#000000', strokeThickness: 4, wordWrap: { width: 480 },
		}).setOrigin(0.5, 0.5);
		body.setLineSpacing(4);
		this.add(body);

		makeButton(scene, this, 0, 100, 'TRY AGAIN', 0.24, () => scene.restartGame());
		makeButton(scene, this, 0, 168, 'MENU', 0.16, () => scene.returnToMenu());

		this.add(scene.add.text(0, 214, 'Press R to try again', {
			align: 'center', color: '#999999', fontSize: '16px',
		}).setOrigin(0.5, 0.5));
	}

	show() {
		this.visible = true;
		this.alpha = 0;
		this.scene.tweens.add({ targets: this, alpha: 1, duration: 800, ease: 'Power2' });
	}
}
