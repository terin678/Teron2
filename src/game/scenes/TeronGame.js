import {
	BOSS_POS, BOSS_LOSE_RANGE, DIFFICULTIES, GHOST, WALLS, DECOR_DOTS, GHOST_NAMES, CHEATS,
} from '../../core/constants.js';
import { eventSig, bareCode, findAction, bindLabel } from '../../core/settings.js';
import { addRecord } from '../../core/records.js';
import { TabCycler, nearest } from '../../core/targeting.js';
import { recommendSlot } from '../../core/coach.js';
import { TUTORIAL_STEPS } from '../../core/tutorial.js';
import { Player } from '../prefabs/Player.js';
import { Ghost } from '../prefabs/Ghost.js';
import { Debuff } from '../prefabs/Debuff.js';
import { TargetFrame } from '../prefabs/TargetFrame.js';
import { AbilityBar } from '../prefabs/AbilityBar.js';
import { WinOverlay, LoseOverlay } from '../prefabs/Overlays.js';
import { SoundToggle } from '../prefabs/SoundToggle.js';

const GHOST_BENCH = [[207, 689], [272, 689], [329, 688], [387, 688]];

// Sound keys owned by this scene — cleaned up before re-adding on restart.
const GAME_SOUND_KEYS = [
	'ghost_Spawn', 'ghost_Death', 'teron_Aggro', 'teron_Death', 'teron_Enrage',
	'blackTempleMusic', 'horsemanLaugh', 'orcKidLaugh',
	'teron_Special1', 'teron_Special2', 'teron_deathCoil', 'teron_DeathAndDecay',
	'spiritStrike_Cast', 'spiritStrike_Impact', 'spiritLance_Cast', 'spiritLance_Impact',
	'spiritChains_Cast', 'spiritChains_Impact', 'spiritVolley_Cast', 'spiritVolley_Impact',
];

export class TeronGame extends Phaser.Scene {

	constructor() {
		super('TeronGame');
	}

	init(data) {
		this.difficulty = DIFFICULTIES[data?.difficulty] ?? DIFFICULTIES.normal;
	}

	create() {
		this.settings = this.registry.get('settings');
		this.gameEnded = false;
		this.ghostsSpawned = false;
		this.ghostSpawnAt = null;
		this.hoveredGhost = null;
		this.held = { moveUp: false, moveDown: false, moveLeft: false, moveRight: false };
		this.cycler = new TabCycler();
		this.tutorialHold = false;

		// Cheats
		this.cheatBuffers = { noLose: '', noCooldowns: '' };
		this.cheatNoLose = false;
		this.cheatNoCooldowns = false;

		for (const key of GAME_SOUND_KEYS) this.sound.removeByKey(key);

		this.buildArena();
		this.buildActors();
		this.buildObjectiveIndicator();
		this.initSounds();
		this.initInput();
		this.initPauseHandling();
		if (this.difficulty.hints) this.initHints();
		if (this.difficulty.tutorial) this.initTutorial();

		const firstKey = 'attempted.' + this.difficulty.id;
		const firstAttempt = !this.registry.get(firstKey);
		this.registry.set(firstKey, true);
		const prepSeconds = firstAttempt ? this.difficulty.firstPrepSeconds : this.difficulty.retryPrepSeconds;
		if (this.difficulty.tutorial) {
			// Tutorial lesson 1: the countdown holds until the player runs away.
			this.debuff.holdAt(prepSeconds);
		} else {
			this.debuff.setRemainingSeconds(prepSeconds);
		}

		if (!this.sys.game.device.os.desktop) this.reconfigureForMobile();

		this.gameStartAt = null; // set on first update; time.now is invalid during create
		this.lastBark = null;
		this.lastBarkCheckAt = null;

		this.teronAggroSound.play({ delay: 0.3 });
		this.music.play({ volume: 0.15 });
	}

	// ------------------------------------------------------------- arena

	buildArena() {
		this.add.image(300, 400, 'background').setDepth(-5);

		this.walls = this.physics.add.staticGroup();
		for (const [x, y, w, h] of WALLS) {
			const rect = this.add.rectangle(x, y, w, h);
			this.physics.add.existing(rect, true);
			this.walls.add(rect);
		}

		for (const [x, y, color] of DECOR_DOTS) {
			const dot = this.add.ellipse(x, y, 17, 17);
			dot.isFilled = true;
			dot.fillColor = color;
		}
	}

	buildActors() {
		this.debuff = new Debuff(this, 527, 163);
		this.debuff.setScale(0.75);
		this.add.existing(this.debuff);

		this.targetHighlight = this.add.ellipse(300, 762, 27, 27);
		this.targetHighlight.isStroked = true;
		this.targetHighlight.strokeColor = 0xcf1111;
		this.targetHighlight.strokeAlpha = 0.75;
		this.targetHighlight.lineWidth = 3;
		this.targetHighlight.visible = false;

		// Only drawn while mouseover casting is enabled, so it is always obvious
		// when the cursor - rather than the red target ring - owns the next cast.
		this.hoverHighlight = this.add.ellipse(300, 762, 34, 34);
		this.hoverHighlight.isStroked = true;
		this.hoverHighlight.strokeColor = 0xffd21f;
		this.hoverHighlight.strokeAlpha = 0.9;
		this.hoverHighlight.lineWidth = 2;
		this.hoverHighlight.visible = false;

		this.ghosts = GHOST_BENCH.map(([x, y], i) => {
			const ghost = new Ghost(this, x, y, GHOST_NAMES[i]);
			this.add.existing(ghost);
			return ghost;
		});

		this.freezeIndicators = this.ghosts.map(() => {
			const diamond = this.add.rectangle(0, 0, 30, 30);
			diamond.isStroked = true;
			diamond.strokeColor = 0x29a4fb;
			diamond.lineWidth = 2;
			diamond.angle = 45;
			diamond.visible = false;
			return diamond;
		});

		this.player = new Player(this, 245, 152);
		this.add.existing(this.player);
		this.physics.add.collider(this.player, this.walls);

		this.abilityBar = new AbilityBar(this, 193, 766);
		this.abilityBar.setScale(0.66);
		this.abilityBar.visible = false;
		this.add.existing(this.abilityBar);
		this.abilityBar.player = this.player;
		this.abilityBar.ghosts = this.ghosts;
		this.abilityBar.settings = this.settings;
		this.abilityBar.getHoveredGhost = () => this.hoveredGhost;
		this.abilityBar.refreshBindLabels();

		this.targetFrame = new TargetFrame(this, 343, 239);
		this.add.existing(this.targetFrame);
		this.abilityBar.targetFrame = this.targetFrame;

		this.add.existing(new SoundToggle(this, 544, 34));

		this.winOverlay = new WinOverlay(this, 300, 300);
		this.winOverlay.setDepth(10);
		this.add.existing(this.winOverlay);

		this.loseOverlay = new LoseOverlay(this, 300, 330);
		this.loseOverlay.setDepth(10);
		this.add.existing(this.loseOverlay);
	}

	// Pulsing ring + label so new players know WHERE the constructs are heading.
	buildObjectiveIndicator() {
		this.bossRing = this.add.ellipse(BOSS_POS.x, BOSS_POS.y, 48, 48);
		this.bossRing.isStroked = true;
		this.bossRing.strokeColor = 0xffd21f;
		this.bossRing.lineWidth = 3;
		this.tweens.add({
			targets: this.bossRing,
			scaleX: 1.35, scaleY: 1.35, alpha: 0.35,
			duration: 800, yoyo: true, repeat: -1,
		});

		this.objectiveText = this.add.text(300, 335, 'Protect Teron!\nKill all 4 constructs before any reaches him.', {
			align: 'center', color: '#ffd21f', fontSize: '19px', fontStyle: 'bold',
			stroke: '#000000', strokeThickness: 4, wordWrap: { width: 570 },
		}).setOrigin(0.5, 0.5);
	}

	hideObjectiveIndicator() {
		this.tweens.add({
			targets: [this.bossRing, this.objectiveText],
			alpha: 0, duration: 900,
			onComplete: () => { this.bossRing.visible = false; this.objectiveText.visible = false; },
		});
	}

	initSounds() {
		this.ghostSpawnSound = this.sound.add('ghost_Spawn', { volume: 0.3 });
		this.teronAggroSound = this.sound.add('teron_Aggro');
		this.teronDeathSound = this.sound.add('teron_Death');
		this.teronEnrageSound = this.sound.add('teron_Enrage');
		this.music = this.sound.add('blackTempleMusic');
		this.horsemanLaugh = this.sound.add('horsemanLaugh');
		this.orcKidLaugh = this.sound.add('orcKidLaugh');
		this.barks = [
			this.sound.add('teron_Special1'),
			this.sound.add('teron_Special2'),
			this.sound.add('teron_deathCoil'),
			this.sound.add('teron_DeathAndDecay'),
		];
	}

	// ------------------------------------------------------------- input

	initInput() {
		this.input.keyboard.on('keydown', this.onKeyDown, this);
		this.input.keyboard.on('keyup', this.onKeyUp, this);

		// Extra mouse buttons (back/forward) can be bound to abilities.
		this.input.on('pointerdown', pointer => {
			if (pointer.button >= 3) {
				pointer.event?.preventDefault();
				const action = findAction(this.settings.binds, 'Mouse' + pointer.button);
				if (action) this.runTriggerAction(action);
			}
		});

		// Ghost targeting: any mouse button, generous hit area.
		for (const ghost of this.ghosts) {
			ghost.on('pointerdown', () => {
				if (ghost.alive && ghost.visible && !this.gameEnded) this.selectTarget(ghost);
			});
		}

		// Click / touch to move.
		this.backgroundZone = this.add.zone(300, 400, 600, 800).setInteractive();
		this.backgroundZone.setDepth(-4);
		const desktop = this.sys.game.device.os.desktop;
		this.backgroundZone.on('pointerdown', pointer => {
			if (this.gameEnded) return;
			if (pointer.button !== 0) return;
			this.player.setMoveTarget(pointer, desktop);
		});
		this.input.on('pointerup', () => {
			if (this.player.followTarget) this.player.setMoveTarget(null);
		});

		this.events.on('binds-changed', () => this.abilityBar.refreshBindLabels());
	}

	onKeyDown(e) {
		if (this.gameEnded) {
			if (e.code === 'KeyR' || e.code === 'Enter') this.restartGame();
			return;
		}

		this.feedCheats(e);

		const sig = eventSig(e);
		const action = findAction(this.settings.binds, sig);
		if (e.code === 'Tab') e.preventDefault(); // never let focus leave the game
		if (!action) return;

		if (action in this.held) {
			e.preventDefault();
			this.held[action] = true;
			return;
		}
		e.preventDefault();
		if (e.repeat) return;
		this.runTriggerAction(action);
	}

	onKeyUp(e) {
		// Clear held movement by bare code so a shift press/release mismatch can't stick keys.
		for (const action of Object.keys(this.held)) {
			const binds = this.settings.binds[action] ?? [];
			if (binds.some(b => b && bareCode(b) === e.code)) this.held[action] = false;
		}
	}

	runTriggerAction(action) {
		switch (action) {
			case 'ability0': case 'ability1': case 'ability2': case 'ability3': case 'ability4':
				this.abilityBar.tryActivate(Number(action.slice(7)));
				break;
			case 'targetNext': this.selectNextTarget(false); break;
			case 'targetPrev': this.selectNextTarget(true); break;
			case 'targetNearest': {
				const near = nearest(this.aliveGhosts(), this.player);
				if (near) this.selectTarget(near);
				break;
			}
			case 'pause': this.pauseGame(); break;
		}
	}

	feedCheats(e) {
		if (!/^[a-z]$/i.test(e.key)) return;
		const letter = e.key.toLowerCase();
		for (const [cheat, target] of Object.entries(CHEATS)) {
			let buffer = this.cheatBuffers[cheat] + letter;
			if (!target.startsWith(buffer)) buffer = target.startsWith(letter) ? letter : '';
			if (buffer === target) {
				buffer = '';
				if (cheat === 'noLose' && !this.cheatNoLose) {
					this.cheatNoLose = true;
					this.horsemanLaugh.play();
				} else if (cheat === 'noCooldowns' && !this.cheatNoCooldowns) {
					this.cheatNoCooldowns = true;
					this.abilityBar.nocooldowns = true;
					this.orcKidLaugh.play();
				}
			}
			this.cheatBuffers[cheat] = buffer;
		}
	}

	// ------------------------------------------------------------- targeting

	aliveGhosts() {
		return this.ghosts.filter(g => g.alive && g.visible);
	}

	selectTarget(ghost) {
		this.targetFrame.setTarget(ghost);
		if (ghost) this.events.emit('target-selected', ghost);
	}

	selectNextTarget(reverse) {
		const alive = this.aliveGhosts();
		const current = this.targetFrame.target;
		const next = reverse
			? this.cycler.prev(alive, this.player, current)
			: this.cycler.next(alive, this.player, current);
		if (next) this.selectTarget(next);
		else this.targetFrame.setTarget(null);
	}

	// ------------------------------------------------------------- pause

	initPauseHandling() {
		this.autoPauseHandler = () => this.pauseGame();
		this.game.events.on(Phaser.Core.Events.BLUR, this.autoPauseHandler);
		this.game.events.on(Phaser.Core.Events.HIDDEN, this.autoPauseHandler);

		this.events.on(Phaser.Scenes.Events.RESUME, () => {
			this.held = { moveUp: false, moveDown: false, moveLeft: false, moveRight: false };
			this.sound.resumeAll();
		});

		this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.game.events.off(Phaser.Core.Events.BLUR, this.autoPauseHandler);
			this.game.events.off(Phaser.Core.Events.HIDDEN, this.autoPauseHandler);
		});
	}

	pauseGame() {
		if (this.gameEnded || !this.scene.isActive()) return;
		this.scene.launch('Pause');
		this.scene.pause();
		this.sound.pauseAll();
	}

	// ------------------------------------------------------------- hints (practice)

	initHints() {
		this.hintText = this.add.text(300, 560, '', {
			align: 'center', color: '#9fd3ff', fontSize: '18px', fontStyle: 'bold',
			stroke: '#000000', strokeThickness: 4, wordWrap: { width: 560 },
		}).setOrigin(0.5, 0.5).setDepth(5);

		const b = action => bindLabel(this.settings.binds[action]?.[0]);
		this.showHint('Get to a back corner before the timer ends —\nconstructs spawn where you die!');

		this.events.once('ghosts-spawned', () => {
			this.showHint('Press ' + b('targetNext') + ' or click a construct to target it');
			this.events.once('target-selected', () => {
				this.showHint('Lead with Spirit Volley [' + b('ability3') + ']');
				const onCast = id => {
					if (id !== 'volley') { this.events.once('ability-cast', onCast); return; }
					this.showHint('Now Chains [' + b('ability2') + '] to freeze the pack, then Lance [' + b('ability1') + '] all four —\n' +
						'swap target after each Lance.', 8000);
				};
				this.events.once('ability-cast', onCast);
			});
		});
	}

	showHint(message, ms = 0) {
		if (!this.hintText) return;
		this.hintText.setText(message);
		this.hintText.alpha = 1;
		if (this.hintTimer) this.hintTimer.remove();
		if (ms > 0) {
			this.hintTimer = this.time.delayedCall(ms, () => {
				this.tweens.add({ targets: this.hintText, alpha: 0, duration: 500 });
			});
		}
	}

	// ------------------------------------------------------------- tutorial

	initTutorial() {
		const b = action => bindLabel(this.settings.binds[action]?.[0]);

		this.tutorialText = this.add.text(300, 500, '', {
			align: 'center', backgroundColor: '#000000cc', color: '#ffd21f',
			fontSize: '20px', fontStyle: 'bold', padding: { x: 16, y: 12 },
			wordWrap: { width: 480 },
		}).setOrigin(0.5, 0.5).setDepth(6);

		this.tutorialMovedAway = false;
		this.tutorialText.setText(
			'First lesson: get to a BACK CORNER, away from Teron (the gold ring)!\n' +
			'The constructs spawn where you die and crawl back to him —\n' +
			'the farther away you die, the more time you have.\n\n' +
			'Move with ' + b('moveUp') + b('moveLeft') + b('moveDown') + b('moveRight') +
			' or click. The timer will wait for you.'
		);

		// Wording for each step; the ORDER lives in src/core/tutorial.js so tests
		// can lock it to the published rotation. `slot` drives the coach glow.
		const TEXT = {
			target: () => 'Press [' + b('targetNext') + '] to target the NEAREST construct.\n(Press it again later to cycle outward.)',
			volley: () => 'Spirit Volley [' + b('ability3') + '] — your big AoE nuke.\nAlways lead with this. Press it!',
			chains: () => 'Spirit Chains [' + b('ability2') + '] — freezes the pack for 5 sec.\n' +
				'Always AFTER Volley: Volley is AoE and would break\nthe freeze on everything. Press it!',
			lance: () => 'Spirit Lance [' + b('ability1') + '] — your filler while those cool down.\n' +
				'Lance ALL four, swapping target ([' + b('targetNext') + ']) after each cast\nso the slow lands on every construct. Press it!',
		};
		const steps = TUTORIAL_STEPS.map(step => ({
			...step,
			text: TEXT[step.id],
			match: step.ability ? (id => id === step.ability) : null,
		}));

		this.events.once('ghosts-spawned', () => {
			this.tutorialHold = true;
			this.runTutorialStep(steps, 0);
		});
	}

	runTutorialStep(steps, index) {
		if (index >= steps.length) {
			this.tutorialHold = false;
			this.tutorialCoachSlot = null; // hand over to the live recommender
			this.hideObjectiveIndicator();
			this.tutorialText.setText('That\'s the rotation! Volley and Chains on cooldown,\n' +
				'Lance everything in between — swap target after each one.\n' +
				'(Strike and Shield aren\'t needed until the constructs are down.) Go!');
			this.time.delayedCall(6000, () => {
				this.tweens.add({ targets: this.tutorialText, alpha: 0, duration: 600 });
			});
			return;
		}
		const step = steps[index];
		this.tutorialCoachSlot = step.slot;
		this.tutorialText.setText(step.text());
		const handler = payload => {
			if (step.match && !step.match(payload)) {
				this.events.once(step.event, handler);
				return;
			}
			this.runTutorialStep(steps, index + 1);
		};
		this.events.once(step.event, handler);
	}

	// ------------------------------------------------------------- game flow

	update() {
		if (this.gameEnded) return;
		if (this.gameStartAt == null) {
			this.gameStartAt = this.time.now;
			this.lastBarkCheckAt = this.time.now;
		}

		this.player.movePlayer(this.held);

		if (this.debuff.visible) {
			// Tutorial lesson 1: the held countdown releases once the player has run away.
			if (this.difficulty.tutorial && !this.tutorialMovedAway &&
				Phaser.Math.Distance.BetweenPoints(this.player, BOSS_POS) > 330) {
				this.tutorialMovedAway = true;
				this.debuff.setRemainingSeconds(5);
				this.tutorialText.setText(
					'Good! When the timer ends you die, and the constructs\n' +
					'spawn around your corpse — nice and far from Teron.'
				);
			}
			this.debuff.update();
			if (!this.debuff.visible) this.spawnGhosts();
		}

		this.abilityBar.nocooldowns = this.cheatNoCooldowns;
		this.abilityBar.update();
		this.targetFrame.update();

		for (const ghost of this.ghosts) {
			if (this.tutorialHold && ghost.alive && ghost.visible) {
				ghost.body.setVelocity(0, 0);
			} else {
				ghost.update();
			}
		}

		this.updateHover();
		this.updateGhostAddons();
		this.updateCoach();
		this.playRandomBark();
		this.checkGameEnded();
	}

	// Rotation coach: yellow glow on the next recommended ability. During
	// tutorial gates the gate's required ability wins; afterwards (and in any
	// mode with the "Ability coach" setting on) the live recommender drives it.
	updateCoach() {
		let slot = -1;
		if (this.ghostsSpawned && !this.gameEnded) {
			if (this.tutorialCoachSlot !== undefined && this.tutorialCoachSlot !== null) {
				slot = this.tutorialCoachSlot;
			} else if (this.difficulty.tutorial || this.settings.abilityCoach) {
				const alive = this.aliveGhosts();
				slot = recommendSlot({
					player: { x: this.player.x, y: this.player.y },
					ghosts: alive.map(g => ({
						x: g.x, y: g.y, lanceStacks: g.lanceStacks, lanceRemainMs: g.lanceTimeRemaining(),
					})),
					targetIndex: alive.indexOf(this.targetFrame.target),
					ready: this.abilityBar.slots.map(s => this.abilityBar.cooldownRemaining(s) === 0),
				});
			}
		}
		this.abilityBar.setCoachSlot(slot);
	}

	spawnGhosts() {
		this.ghostsSpawned = true;
		this.ghostSpawnAt = this.time.now;
		const off = this.ghostSpawnOffset ?? GHOST.spawnOffset;
		const mult = this.difficulty.ghostSpeedMult;
		this.ghosts[0].spawn(this.player.x - off, this.player.y - off, mult);
		this.ghosts[1].spawn(this.player.x + off, this.player.y - off, mult);
		this.ghosts[2].spawn(this.player.x - off, this.player.y + off, mult);
		this.ghosts[3].spawn(this.player.x + off, this.player.y + off, mult);

		this.abilityBar.visible = true;
		this.abilityBar.y += 37;
		this.tweens.add({
			targets: this.abilityBar,
			y: this.abilityBar.y - 37,
			duration: 500,
			ease: 'Quart.easeOut',
		});

		this.player.changeToGhost();
		this.ghostSpawnSound.play();
		if (!this.difficulty.tutorial) {
			this.time.delayedCall(4000, () => this.hideObjectiveIndicator());
		}
		this.events.emit('ghosts-spawned');
	}

	// Recomputed every frame from the live pointer. Phaser's pointerover/
	// pointerout events go stale when ghosts drift under a stationary cursor,
	// which let casts fly at a construct the player was no longer hovering.
	updateHover() {
		if (!this.settings.mouseoverCast || this.gameEnded) {
			this.hoveredGhost = null;
			return;
		}
		const pointer = this.input.activePointer;
		let best = null;
		let bestDist = Infinity;
		for (const ghost of this.aliveGhosts()) {
			const radius = Math.max(ghost.displayWidth, ghost.displayHeight) * 0.7;
			const d = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, ghost.x, ghost.y);
			if (d <= radius && d < bestDist) {
				best = ghost;
				bestDist = d;
			}
		}
		this.hoveredGhost = best;
	}

	updateGhostAddons() {
		const target = this.targetFrame.target;
		this.targetHighlight.visible = target != null;
		if (target) {
			this.targetHighlight.x = target.x;
			this.targetHighlight.y = target.y;
		}

		const hovered = this.hoveredGhost;
		this.hoverHighlight.visible = hovered != null && hovered !== target;
		if (this.hoverHighlight.visible) {
			this.hoverHighlight.x = hovered.x;
			this.hoverHighlight.y = hovered.y;
		}
		this.ghosts.forEach((ghost, i) => {
			const diamond = this.freezeIndicators[i];
			diamond.visible = ghost.alive && ghost.frozen;
			diamond.x = ghost.x;
			diamond.y = ghost.y;
		});
	}

	playRandomBark() {
		const now = this.time.now;
		if (now - this.gameStartAt < 4000) return; // aggro line still playing
		if (now - this.lastBarkCheckAt < 1000) return;
		this.lastBarkCheckAt = now;
		if (this.barks.some(s => s.isPlaying)) return;
		const bark = this.barks[Math.floor(Math.random() * this.barks.length)];
		if (bark === this.lastBark) return;
		if (Math.random() < 0.2) {
			bark.play();
			this.lastBark = bark;
		}
	}

	checkGameEnded() {
		if (this.ghostsSpawned && this.ghosts.every(g => !g.alive)) {
			this.winGame();
		} else if (!this.cheatNoLose && this.ghosts.some(
			g => g.alive && g.visible && Phaser.Math.Distance.BetweenPoints(g, BOSS_POS) < BOSS_LOSE_RANGE)) {
			this.loseGame();
		}
	}

	endCommon() {
		this.gameEnded = true;
		this.abilityBar.gameEnded = true;
		this.player.stopMoving();
		this.targetFrame.setTarget(null);
		this.targetHighlight.visible = false;
		this.hoveredGhost = null;
		this.hoverHighlight.visible = false;
		this.bossRing.visible = false;
		this.objectiveText.visible = false;
		this.barks.forEach(s => s.stop());
		if (this.hintText) this.hintText.visible = false;
		if (this.tutorialText) this.tutorialText.visible = false;
	}

	winGame() {
		this.endCommon();
		const seconds = (this.time.now - this.ghostSpawnAt) / 1000;
		this.teronDeathSound.play({ delay: 1.3 });

		const cheated = this.cheatNoLose || this.cheatNoCooldowns;
		if (cheated) {
			this.winOverlay.show(seconds, { cheated: true });
		} else if (this.difficulty.noRecords) {
			this.winOverlay.show(seconds, { noRecords: true });
		} else {
			this.winOverlay.show(seconds, addRecord(this.difficulty.id, seconds));
		}
	}

	loseGame() {
		this.endCommon();
		this.ghosts.forEach(g => g.stopMoving());
		this.teronEnrageSound.play({ delay: 0.75 });
		this.loseOverlay.show();
	}

	restartGame() {
		this.music.stop();
		this.scene.restart({ difficulty: this.difficulty.id });
	}

	returnToMenu() {
		this.music.stop();
		this.scene.start('Menu');
	}

	reconfigureForMobile() {
		this.abilityBar.setScale(1.4);
		this.abilityBar.x = 74;
		this.abilityBar.y = 727;

		const ghostScaleFactor = 2;
		this.ghosts.forEach(g => g.setScale(g.scaleX * ghostScaleFactor));
		this.freezeIndicators.forEach(d => d.setScale(ghostScaleFactor));
		this.targetHighlight.setScale(ghostScaleFactor);
		this.ghostSpawnOffset = GHOST.spawnOffset * 1.6;

		this.physics.add.collider(this.ghosts, this.ghosts);
		this.player.setScale(this.player.scaleX * 1.5);
	}
}
