export class Preload extends Phaser.Scene {

	constructor() {
		super('Preload');
	}

	preload() {
		const progressText = this.add.text(300, 404, '0%', { fontSize: '30px' }).setOrigin(0.5, 0.5);
		this.add.text(300, 280, 'Teron Loading\nPlease Wait...', { fontSize: '30px', align: 'center' }).setOrigin(0.5, 0.5);
		const progressBar = this.add.rectangle(46, 322, 512, 48).setOrigin(0, 0);
		progressBar.isFilled = true;
		progressBar.scaleX = 0;

		this.load.on(Phaser.Loader.Events.PROGRESS, p => {
			progressText.setText(Math.floor(p * 100) + '%');
			progressBar.scaleX = p;
		});

		// Images
		this.load.image('background', 'assets/background.png');
		this.load.image('blueFlare', 'assets/animations/blue.png');
		this.load.image('check', 'assets/check.png');
		this.load.image('coffee', 'assets/coffee.png');
		this.load.image('ghost_transparent', 'assets/ghost_transparent.png');
		this.load.image('soundOff', 'assets/soundOff.png');
		this.load.image('soundOn', 'assets/soundOn.png');
		this.load.image('spellFrame', 'assets/spellFrame.png');
		this.load.image('targetFrame', 'assets/targetFrame.png');
		this.load.image('debuff_shadowOfDeath', 'assets/spells/debuff_shadowOfDeath.jpg');
		this.load.image('spell_spiritChains', 'assets/spells/spell_spiritChains.jpg');
		this.load.image('spell_spiritLance', 'assets/spells/spell_spiritLance.jpg');
		this.load.image('spell_spiritShield', 'assets/spells/spell_spiritShield.jpg');
		this.load.image('spell_spiritStrike', 'assets/spells/spell_spiritStrike.jpg');
		this.load.image('spell_spiritVolley', 'assets/spells/spell_spiritVolley.jpg');

		// Spritesheets
		this.load.spritesheet('balls', 'assets/sprites/balls.png', { frameWidth: 17, frameHeight: 17 });
		this.load.spritesheet('buttons', 'assets/buttons.png', { frameWidth: 750, frameHeight: 274 });

		// Audio (ogg preferred, mp3 fallback)
		const audio = (key, path, oggAndMp3 = true) => {
			const urls = oggAndMp3 ? [path + '.ogg', path + '.mp3'] : [path + '.mp3'];
			this.load.audio(key, urls);
		};
		audio('blackTempleAmbience', 'assets/sounds/environment/blackTempleAmbience');
		audio('blackTempleMusic', 'assets/sounds/environment/blackTempleMusic', false);
		audio('horsemanLaugh', 'assets/sounds/environment/horsemanLaugh');
		audio('orcKidLaugh', 'assets/sounds/environment/orcKidLaugh');
		audio('ghost_Death', 'assets/sounds/ghost/ghost_Death');
		audio('ghost_Spawn', 'assets/sounds/ghost/ghost_Spawn');
		audio('spiritChains_Cast', 'assets/sounds/spells/spiritChains_Cast');
		audio('spiritChains_Impact', 'assets/sounds/spells/spiritChains_Impact');
		audio('spiritLance_Cast', 'assets/sounds/spells/spiritLance_Cast');
		audio('spiritLance_Impact', 'assets/sounds/spells/spiritLance_Impact');
		audio('spiritStrike_Cast', 'assets/sounds/spells/spiritStrike_Cast');
		audio('spiritStrike_Impact', 'assets/sounds/spells/spiritStrike_Impact');
		audio('spiritVolley_Cast', 'assets/sounds/spells/spiritVolley_Cast');
		audio('spiritVolley_Impact', 'assets/sounds/spells/spiritVolley_Impact');
		audio('teron_Aggro', 'assets/sounds/teron/teron_Aggro');
		audio('teron_Death', 'assets/sounds/teron/teron_Death');
		audio('teron_DeathAndDecay', 'assets/sounds/teron/teron_DeathAndDecay');
		audio('teron_deathCoil', 'assets/sounds/teron/teron_deathCoil');
		audio('teron_Enrage', 'assets/sounds/teron/teron_Enrage');
		audio('teron_Intro', 'assets/sounds/teron/teron_Intro');
		audio('teron_Special1', 'assets/sounds/teron/teron_Special1');
		audio('teron_Special2', 'assets/sounds/teron/teron_Special2');
	}

	create() {
		this.scene.start('Menu');
	}
}
