import { ABILITIES } from '../../core/constants.js';
import { bindLabel } from '../../core/settings.js';
import { loadRecords, formatTime } from '../../core/records.js';
import { SoundToggle } from '../prefabs/SoundToggle.js';

const INTRO_TEXT =
	"It's just another day in Black Temple... your raid is fighting Teron Gorefiend " +
	"again and again and just keeps on wiping.\n\n" +
	"It's the eleventh try for today... finally you are the one who gets the Shadow of " +
	"Death debuff! Now it's up to you to prevent the deadly constructs from wiping your raid!\n\n" +
	"Move with W,A,S,D / arrows, or click and hold. When you die, the petbar appears with " +
	"the skills to deal with the constructs — click them or press their keys. Tab targets the " +
	"nearest construct and cycles outward; you can also just click (or right-click) them.\n\n" +
	"Your objective: the constructs crawl toward Teron — if one reaches him, the raid " +
	"wipes. Kill all four first!\n\n" +
	"Every key is rebindable in Options, mouseover casting is on by default, and Esc pauses. " +
	"New here? The Tutorial walks you through each ability step by step.\n\nGood luck!";

function menuButton(scene, x, y, label, scale, fontSize, onClick) {
	const image = scene.add.image(x, y, 'buttons', 2).setScale(scale);
	image.setInteractive({ useHandCursor: true });
	const text = scene.add.text(x, y - 2, label, {
		align: 'center', fontSize: fontSize, strokeThickness: 3,
	}).setOrigin(0.5, 0.5);
	image.on('pointerover', () => text.setTint(0xf6e91f));
	image.on('pointerout', () => text.clearTint());
	image.on('pointerdown', onClick);
	return { image, text };
}

export class Menu extends Phaser.Scene {

	constructor() {
		super('Menu');
	}

	create() {
		this.add.image(300, 400, 'background');
		const dim = this.add.rectangle(300, 400, 600, 800, 0x000000, 0.7);
		dim.isFilled = true;

		this.add.text(0, 96, 'Teron', {
			align: 'center', fixedWidth: 600, fontSize: '48px', strokeThickness: 2,
		});

		this.bestText = this.add.text(300, 168, '', {
			align: 'center', color: '#c9c9c9', fontSize: '15px',
		}).setOrigin(0.5, 0.5);
		this.refreshBestTimes();

		this.introText = this.add.text(0, 205, INTRO_TEXT, {
			align: 'center', fixedWidth: 600, fontSize: '15.5px', stroke: '#000000',
		});
		this.introText.setLineSpacing(3);
		this.introText.setWordWrapWidth(550);

		this.spellbookPanel = this.buildSpellbookPanel();
		this.spellbookPanel.visible = false;

		// Buttons
		menuButton(this, 476, 655, 'START', 0.25, '42px', () => this.startGame('normal'));
		menuButton(this, 476, 725, 'PRACTICE', 0.17, '22px', () => this.startGame('practice'));
		menuButton(this, 293, 655, 'TUTORIAL', 0.17, '22px', () => this.startGame('tutorial'));
		menuButton(this, 293, 715, '3D MODE', 0.17, '22px', () => { window.location.href = '3d.html'; });
		menuButton(this, 110, 655, 'OPTIONS', 0.17, '22px', () => {
			this.scene.launch('Options', { from: 'Menu' });
		});
		const spellbook = menuButton(this, 110, 715, 'SPELLBOOK', 0.17, '20px', () => {
			this.introText.visible = !this.introText.visible;
			this.bestText.visible = this.introText.visible;
			this.spellbookPanel.visible = !this.spellbookPanel.visible;
		});

		this.add.existing(new SoundToggle(this, 544, 34));

		// Credits
		this.add.text(0, 756, 'Based on terongame by Faldorn — teron.faldorn.net | Valhalla, Arugal-US', {
			align: 'center', fixedWidth: 600, fontSize: '14px',
		});
		this.add.text(0, 776, '*** Used graphics and sounds are property of Blizzard Entertainment ***', {
			align: 'center', fixedWidth: 600, fontSize: '13px',
		});

		const coffeeFaldorn = this.add.image(70, 22, 'coffee').setInteractive({ useHandCursor: true });
		coffeeFaldorn.on('pointerdown', () => window.open('https://www.buymeacoffee.com/faldorn', '_blank'));
		this.add.text(139, 22, 'Faldorn', { fontSize: '11px', color: '#cccccc' }).setOrigin(0, 0.5);

		const coffeeGlorp = this.add.image(70, 60, 'coffee').setInteractive({ useHandCursor: true });
		coffeeGlorp.on('pointerdown', () => window.open('https://buymeacoffee.com/glorp', '_blank'));
		this.add.text(139, 60, 'glorp', { fontSize: '11px', color: '#cccccc' }).setOrigin(0, 0.5);

		this.startAudio();

		// Refresh bind labels in the spellbook when Options closes
		this.events.on('options-closed', () => {
			const wasVisible = this.spellbookPanel.visible;
			this.spellbookPanel.destroy();
			this.spellbookPanel = this.buildSpellbookPanel();
			this.spellbookPanel.visible = wasVisible;
		});
	}

	refreshBestTimes() {
		const records = loadRecords();
		const line = mode => records[mode].length ? formatTime(records[mode][0]) : '—';
		this.bestText.setText('Best times    Normal: ' + line('normal') + '    Practice: ' + line('practice'));
	}

	buildSpellbookPanel() {
		const settings = this.registry.get('settings');
		const panel = this.add.container(0, 0);
		let y = 210;
		for (const ability of ABILITIES) {
			const icon = this.add.image(70, y + 20, ability.icon).setScale(0.8);
			const bind = settings.binds['ability' + ability.slot];
			const name = this.add.text(105, y, ability.name + '  [' + bindLabel(bind?.[0]) + ']', {
				color: '#f6d21f', fontSize: '17px', fontStyle: 'bold',
			});
			const desc = this.add.text(105, y + 22, ability.desc, {
				color: '#dddddd', fontSize: '13px', wordWrap: { width: 430 },
			});
			panel.add([icon, name, desc]);
			y += 74;
		}
		panel.add(this.add.text(105, y + 4,
			'Tab: target nearest, then cycle outward. Shift-Tab: reverse.\n' +
			'Mouseover casting: Strike/Lance hit the hovered construct.\n' +
			'Esc: pause. All keys rebindable in Options.', {
			color: '#9fd3ff', fontSize: '13px', wordWrap: { width: 460 },
		}));
		return panel;
	}

	startGame(difficulty) {
		this.stopMenuAudio();
		this.scene.start('TeronGame', { difficulty });
	}

	startAudio() {
		const begin = () => {
			if (!this.introSpeech) {
				this.introSpeech = this.sound.add('teron_Intro');
				this.introSpeech.play();
			}
			const ambience = this.sound.get('blackTempleAmbience');
			if (!ambience || !ambience.isPlaying) {
				this.sound.play('blackTempleAmbience', { loop: true, volume: 0.5 });
			}
		};
		if (this.sound.locked) {
			this.sound.once(Phaser.Sound.Events.UNLOCKED, begin);
		} else {
			begin();
		}
	}

	stopMenuAudio() {
		if (this.introSpeech && this.introSpeech.isPlaying) this.introSpeech.stop();
		this.introSpeech = null;
	}
}
