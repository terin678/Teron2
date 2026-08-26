// Teron 3D — Three.js front-end over the same simulation rules as the 2D game.
// The sim runs in the original 2D coordinate space (x 0-600, y 0-800, boss north);
// rendering maps it onto the ground plane: worldX = x - 300, worldZ = y - 400.

import * as THREE from '../../lib/three.module.min.js';
import {
	BOSS_POS, DOORWAY_POS, CORRIDOR, BOSS_LOSE_RANGE, PLAYER_SPEED, PX_PER_YARD,
	GHOST, GCD_MS, DIFFICULTIES, ABILITIES, WALLS, DECOR_DOTS, GHOST_NAMES, CHEATS,
} from '../core/constants.js';
import { loadSettings, saveSettings, eventSig, bareCode, findAction, bindLabel } from '../core/settings.js';
import { TabCycler, nearest } from '../core/targeting.js';
import { loadRecords, addRecord, formatTime, parseTier } from '../core/records.js';
import { recommendSlot } from '../core/coach.js';

const $ = id => document.getElementById(id);
const to3D = (x, y) => new THREE.Vector3(x - 300, 0, y - 400);

// ------------------------------------------------------------------ audio

// Sounds marked LAZY are big (music + ambience are ~2.5 MB of the ~3.7 MB total)
// or rare (cheat stingers). They are not fetched on page load — the browser
// pulls them the first time they're played, which for music/ambience is when a
// run actually starts.
const LAZY = 'lazy';

const SOUND_DEFS = {
	aggro: ['teron/teron_Aggro', 1.0],
	teronDeath: ['teron/teron_Death', 1.0],
	enrage: ['teron/teron_Enrage', 1.0],
	music: ['environment/blackTempleMusic', 0.15, LAZY],
	ambience: ['environment/blackTempleAmbience', 0.5, LAZY],
	ghostSpawn: ['ghost/ghost_Spawn', 0.3],
	ghostDeath: ['ghost/ghost_Death', 0.3],
	horsemanLaugh: ['environment/horsemanLaugh', 1.0, LAZY],
	orcKidLaugh: ['environment/orcKidLaugh', 1.0, LAZY],
	bark1: ['teron/teron_Special1', 1.0],
	bark2: ['teron/teron_Special2', 1.0],
	bark3: ['teron/teron_deathCoil', 1.0],
	bark4: ['teron/teron_DeathAndDecay', 1.0],
	strike_Cast: ['spells/spiritStrike_Cast', 0.3],
	strike_Impact: ['spells/spiritStrike_Impact', 0.25],
	lance_Cast: ['spells/spiritLance_Cast', 0.2],
	lance_Impact: ['spells/spiritLance_Impact', 0.2],
	chains_Cast: ['spells/spiritChains_Cast', 0.3],
	chains_Impact: ['spells/spiritChains_Impact', 0.25],
	volley_Cast: ['spells/spiritVolley_Cast', 0.3],
	volley_Impact: ['spells/spiritVolley_Impact', 0.25],
};

class AudioBank {
	constructor() {
		this.sounds = {};
		for (const [key, [path, vol, lazy]] of Object.entries(SOUND_DEFS)) {
			// preload must be set before src, or the hint doesn't apply to the fetch.
			const a = new Audio();
			a.preload = lazy ? 'none' : 'auto';
			a.src = 'assets/sounds/' + path + '.mp3';
			a.volume = vol;
			this.sounds[key] = a;
		}
		this.sounds.music.loop = true;
		this.sounds.ambience.loop = true;
		this.muted = false;
	}
	// delaySec matches the original's Phaser `play({ delay })` timings.
	play(key, delaySec = 0) {
		if (this.muted) return;
		const a = this.sounds[key];
		if (!a) return;
		const start = () => {
			if (this.muted) return;
			a.currentTime = 0;
			a.play().catch(() => {});
		};
		if (delaySec > 0) setTimeout(start, delaySec * 1000);
		else start();
	}
	isPlaying(key) {
		const a = this.sounds[key];
		return a && !a.paused && !a.ended;
	}
	stop(key) {
		const a = this.sounds[key];
		if (a) { a.pause(); a.currentTime = 0; }
	}
	setMuted(m) {
		this.muted = m;
		for (const a of Object.values(this.sounds)) a.muted = m;
	}
	pauseLoops() { this.sounds.music.pause(); this.sounds.ambience.pause(); }
	resumeLoops() {
		if (this.muted) return;
		if (this._musicOn) this.sounds.music.play().catch(() => {});
		this.sounds.ambience.play().catch(() => {});
	}
	startLoops() {
		this._musicOn = true;
		if (this.muted) return;
		this.sounds.ambience.play().catch(() => {});
		this.sounds.music.play().catch(() => {});
	}
}

// ------------------------------------------------------------------ game

class Game3D {

	constructor() {
		this.settings = loadSettings();
		this.audio = new AudioBank();
		this.audio.setMuted(this.settings.muted);

		this.state = 'menu'; // menu | prep | fight | paused | won | lost
		this.pausedFrom = null;
		this.simTime = 0;

		this.initRenderer();
		this.initWorld();
		this.initHud();
		this.initInput();

		this.lastFrame = performance.now();
		requestAnimationFrame(t => this.frame(t));
	}

	// -------------------------------------------------- three.js setup

	initRenderer() {
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		$('app').appendChild(this.renderer.domElement);

		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x0d0b08);
		this.scene.fog = new THREE.Fog(0x0d0b08, 700, 1400);

		this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 3000);
		this.camZoom = 1.0;

		window.addEventListener('resize', () => {
			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(window.innerWidth, window.innerHeight);
		});

		this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
		const sun = new THREE.DirectionalLight(0xfff2d0, 1.4);
		sun.position.set(200, 400, 100);
		this.scene.add(sun);
	}

	initWorld() {
		const texLoader = new THREE.TextureLoader();

		// Ground: the original top-down arena image, mapped 1:1.
		const groundTex = texLoader.load('assets/background.png');
		groundTex.colorSpace = THREE.SRGBColorSpace;
		const ground = new THREE.Mesh(
			new THREE.PlaneGeometry(600, 800),
			new THREE.MeshLambertMaterial({ map: groundTex })
		);
		ground.rotation.x = -Math.PI / 2;
		this.scene.add(ground);
		this.ground = ground;

		// Boss: glowing figure + pulsing objective ring
		const boss = new THREE.Mesh(
			new THREE.ConeGeometry(12, 42, 8),
			new THREE.MeshStandardMaterial({ color: 0x552277, emissive: 0x8833cc, emissiveIntensity: 0.7 })
		);
		boss.position.copy(to3D(BOSS_POS.x, BOSS_POS.y)).setY(21);
		this.scene.add(boss);
		this.bossMesh = boss;

		this.bossRing = this.makeRing(26, 0xffd21f, 0.9);
		this.bossRing.position.copy(to3D(BOSS_POS.x, BOSS_POS.y)).setY(0.3);
		this.scene.add(this.bossRing);

		// Dead raid member dots
		for (const [x, y, color] of DECOR_DOTS) {
			const dot = new THREE.Mesh(
				new THREE.SphereGeometry(5, 10, 10),
				new THREE.MeshLambertMaterial({ color })
			);
			dot.position.copy(to3D(x, y)).setY(2.5);
			this.scene.add(dot);
		}

		// Player
		this.playerMat = new THREE.MeshStandardMaterial({ color: 0xfe4444, emissive: 0xaa2222, emissiveIntensity: 0.5 });
		this.playerMesh = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 16), this.playerMat);
		this.scene.add(this.playerMesh);

		// Ghosts: billboard sprites of the original ghost art
		const ghostTex = texLoader.load('assets/ghost_transparent.png');
		ghostTex.colorSpace = THREE.SRGBColorSpace;
		this.ghosts = GHOST_NAMES.map((name, i) => {
			const mat = new THREE.SpriteMaterial({ map: ghostTex, transparent: true });
			const sprite = new THREE.Sprite(mat);
			sprite.scale.set(34, 34, 1);
			sprite.center.set(0.5, 0.15);
			sprite.visible = false;
			this.scene.add(sprite);
			// 4 segments renders as a diamond, matching the 2D indicator.
			const freezeRing = this.makeRing(15, 0x29a4fb, 0.9, 4);
			freezeRing.visible = false;
			this.scene.add(freezeRing);
			return {
				index: i, name, sprite, mat, freezeRing,
				x: 0, y: 0, alive: true, visible: false,
				hp: GHOST.maxHP, maxSpeed: GHOST.speed, currentSpeed: GHOST.speed,
				spawnAt: 0, frozen: false, frozenAt: -1e9, lanceStacks: 0, lancedAt: -1e9,
			};
		});

		this.targetRing = this.makeRing(13, 0xcf1111, 0.85);
		this.targetRing.visible = false;
		this.scene.add(this.targetRing);

		// Only drawn while mouseover casting is on, so the cursor never quietly
		// steals a cast from the red-ringed target.
		this.hoverRing = this.makeRing(17, 0xffd21f, 0.9);
		this.hoverRing.visible = false;
		this.scene.add(this.hoverRing);

		this.projectiles = []; // {mesh, fromV, toGhost, start, dur}
		this.novas = [];       // {mesh, start, dur}
		this.impacts = [];     // {at, ghost, ability}
		this.scheduled = [];   // {at, fn}
	}

	makeRing(radius, color, opacity, segments = 32) {
		const ring = new THREE.Mesh(
			new THREE.RingGeometry(radius - 2, radius, segments),
			new THREE.MeshBasicMaterial({ color, opacity, transparent: true, side: THREE.DoubleSide })
		);
		ring.rotation.x = -Math.PI / 2;
		ring.position.y = 0.3;
		return ring;
	}

	// -------------------------------------------------- HUD

	initHud() {
		const bar = $('ability-bar');
		this.slots = ABILITIES.map(ability => {
			const div = document.createElement('div');
			div.className = 'slot' + (ability.slot === 1 || ability.slot === 4 ? ' gap' : '');
			div.innerHTML = '<img src="assets/spells/spell_' + ability.icon.replace('spell_', '') + '.jpg" alt="">' +
				'<span class="bind"></span><span class="cd"></span>';
			div.title = ability.name + ' — ' + ability.desc;
			div.addEventListener('pointerdown', e => { e.stopPropagation(); this.tryActivate(ability.slot); });
			bar.appendChild(div);
			return { ability, div, bindEl: div.querySelector('.bind'), cdEl: div.querySelector('.cd'), lastCastAt: -1e9, pressedUntil: 0 };
		});
		this.refreshBindLabels();

		const records = loadRecords();
		const line = mode => (records[mode] && records[mode].length) ? formatTime(records[mode][0]) : '—';
		$('best-line').textContent = 'Best times — Normal: ' + line('normal3d') + '   Practice: ' + line('practice3d');

		$('btn-start').addEventListener('click', () => this.startRun('normal'));
		$('btn-practice').addEventListener('click', () => this.startRun('practice'));
		$('btn-resume').addEventListener('click', () => this.togglePause());
		$('btn-p-restart').addEventListener('click', () => { this.hideOverlays(); this.startRun(this.difficulty.id); });
		$('btn-retry').addEventListener('click', () => { this.hideOverlays(); this.startRun(this.difficulty.id); });
		$('btn-menu3d').addEventListener('click', () => { this.hideOverlays(); this.toMenu(); });

		const soundEl = $('sound-toggle');
		const renderMute = () => { soundEl.textContent = this.settings.muted ? '🔇' : '🔊'; };
		renderMute();
		soundEl.addEventListener('click', () => {
			this.settings.muted = !this.settings.muted;
			this.audio.setMuted(this.settings.muted);
			saveSettings(this.settings);
			renderMute();
		});

		$('start-overlay').style.display = 'flex';
		$('ability-bar').classList.add('disabled');
	}

	refreshBindLabels() {
		for (const slot of this.slots) {
			const binds = this.settings.binds['ability' + slot.ability.slot];
			slot.bindEl.textContent = bindLabel(binds?.[0] ?? binds?.[1] ?? null);
		}
	}

	hideOverlays() {
		for (const id of ['start-overlay', 'pause-overlay', 'end-overlay']) $(id).style.display = 'none';
	}

	showError(message) {
		const el = $('error');
		el.textContent = message;
		el.style.opacity = 1;
		clearTimeout(this._errT);
		this._errT = setTimeout(() => { el.style.opacity = 0; }, 900);
	}

	announce(name) {
		$('announce').textContent = name;
	}

	// -------------------------------------------------- input

	initInput() {
		document.addEventListener('contextmenu', e => e.preventDefault());
		for (const type of ['mousedown', 'mouseup', 'auxclick']) {
			document.addEventListener(type, e => { if (e.button === 3 || e.button === 4) e.preventDefault(); });
		}

		this.held = { moveUp: false, moveDown: false, moveLeft: false, moveRight: false };
		this.cheatBuffers = { noLose: '', noCooldowns: '' };
		this.cheatNoLose = false;
		this.cheatNoCooldowns = false;

		window.addEventListener('keydown', e => this.onKeyDown(e));
		window.addEventListener('keyup', e => this.onKeyUp(e));
		window.addEventListener('blur', () => {
			if (this.state === 'prep' || this.state === 'fight') this.togglePause();
		});

		this.raycaster = new THREE.Raycaster();
		this.pointerNdc = new THREE.Vector2();
		this.hoveredGhost = null;
		this.mouseDown = false;
		this.moveTarget = null; // {x, y} in sim coords

		const canvas = this.renderer.domElement;
		canvas.addEventListener('pointermove', e => this.onPointerMove(e));
		canvas.addEventListener('pointerdown', e => this.onPointerDown(e));
		window.addEventListener('pointerup', () => { this.mouseDown = false; this.followPointer = false; });
		canvas.addEventListener('wheel', e => {
			this.camZoom = Math.min(1.8, Math.max(0.55, this.camZoom + (e.deltaY > 0 ? 0.1 : -0.1)));
			e.preventDefault();
		}, { passive: false });
	}

	onKeyDown(e) {
		if (this.state === 'won' || this.state === 'lost') {
			if (e.code === 'KeyR' || e.code === 'Enter') { this.hideOverlays(); this.startRun(this.difficulty.id); }
			return;
		}
		if (this.state === 'menu') return;

		const sig = eventSig(e);
		const action = findAction(this.settings.binds, sig);
		if (e.code === 'Tab') e.preventDefault();

		if (this.state === 'paused') {
			if (!e.repeat && (e.code === 'Escape' || action === 'pause')) { e.preventDefault(); this.togglePause(); }
			return;
		}

		this.feedCheats(e);
		if (!action) return;
		if (action in this.held) { e.preventDefault(); this.held[action] = true; return; }
		e.preventDefault();
		if (e.repeat) return;
		this.runTriggerAction(action);
	}

	onKeyUp(e) {
		for (const action of Object.keys(this.held)) {
			const binds = this.settings.binds[action] ?? [];
			if (binds.some(b => b && bareCode(b) === e.code)) this.held[action] = false;
		}
	}

	runTriggerAction(action) {
		switch (action) {
			case 'ability0': case 'ability1': case 'ability2': case 'ability3': case 'ability4':
				this.tryActivate(Number(action.slice(7)));
				break;
			case 'targetNext': this.selectNextTarget(false); break;
			case 'targetPrev': this.selectNextTarget(true); break;
			case 'targetNearest': {
				const near = nearest(this.aliveGhosts(), this.player);
				if (near) this.setTarget(near);
				break;
			}
			case 'pause': this.togglePause(); break;
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
				if (cheat === 'noLose' && !this.cheatNoLose) { this.cheatNoLose = true; this.audio.play('horsemanLaugh'); }
				else if (cheat === 'noCooldowns' && !this.cheatNoCooldowns) { this.cheatNoCooldowns = true; this.audio.play('orcKidLaugh'); }
			}
			this.cheatBuffers[cheat] = buffer;
		}
	}

	onPointerMove(e) {
		this.pointerNdc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
		this.updateHover();
		if (this.mouseDown && this.followPointer) this.updateMoveTargetFromPointer();
	}

	updateHover() {
		if (this.state !== 'fight') { this.hoveredGhost = null; return; }
		this.raycaster.setFromCamera(this.pointerNdc, this.camera);
		const sprites = this.aliveGhosts().map(g => g.sprite);
		const hits = this.raycaster.intersectObjects(sprites, false);
		this.hoveredGhost = hits.length ? this.ghosts.find(g => g.sprite === hits[0].object) : null;
		this.renderer.domElement.style.cursor = this.hoveredGhost ? 'pointer' : 'default';
	}

	onPointerDown(e) {
		if (this.state !== 'prep' && this.state !== 'fight') return;
		this.pointerNdc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
		this.updateHover();
		if (this.hoveredGhost) {
			this.setTarget(this.hoveredGhost); // any button targets, like WoW
			return;
		}
		if (e.button === 0) {
			this.mouseDown = true;
			this.followPointer = true;
			this.updateMoveTargetFromPointer();
		}
	}

	updateMoveTargetFromPointer() {
		this.raycaster.setFromCamera(this.pointerNdc, this.camera);
		const hit = this.raycaster.intersectObject(this.ground, false)[0];
		if (hit) {
			this.moveTarget = { x: hit.point.x + 300, y: hit.point.z + 400 };
		}
	}

	// -------------------------------------------------- run lifecycle

	startRun(difficultyId) {
		this.difficulty = DIFFICULTIES[difficultyId] ?? DIFFICULTIES.normal;
		this.recordMode = this.difficulty.id + '3d';
		this.simTime = 0;
		this.state = 'prep';

		this.player = { x: 245, y: 152 };
		this.moveTarget = null;
		this.held = { moveUp: false, moveDown: false, moveLeft: false, moveRight: false };
		this.cheatNoLose = false;
		this.cheatNoCooldowns = false;
		this.playerMat.color.set(0xfe4444);
		this.playerMat.emissive.set(0xaa2222);
		this.playerMat.transparent = false;
		this.playerMat.opacity = 1;

		const attemptedKey = 'teron2.attempted3d.' + this.difficulty.id;
		let first = false;
		try {
			first = !sessionStorage.getItem(attemptedKey);
			sessionStorage.setItem(attemptedKey, '1');
		} catch (err) { /* fine */ }
		this.prepEndsAt = this.simTime + (first ? this.difficulty.firstPrepSeconds : this.difficulty.retryPrepSeconds) * 1000;

		for (const g of this.ghosts) {
			g.alive = true; g.visible = false; g.hp = GHOST.maxHP;
			g.maxSpeed = GHOST.speed * this.difficulty.ghostSpeedMult;
			g.currentSpeed = g.maxSpeed;
			g.frozen = false; g.frozenAt = -1e9; g.lanceStacks = 0; g.lancedAt = -1e9;
			g.sprite.visible = false; g.freezeRing.visible = false;
			g.mat.color.set(0xffffff); g.mat.opacity = 1;
		}
		for (const s of this.slots) { s.lastCastAt = -1e9; s.pressedUntil = 0; }
		this.lastGcdAt = -1e9;
		this.cycler = new TabCycler();
		this.target = null;
		this.impacts = [];
		this.scheduled = [];
		for (const p of this.projectiles) this.scene.remove(p.mesh);
		this.projectiles = [];
		for (const n of this.novas) this.scene.remove(n.mesh);
		this.novas = [];
		this.barkBlockUntil = this.simTime + 4000;
		this.lastBarkCheckAt = 0;
		this.lastBark = null;
		this.ghostSpawnAt = null;

		this.hideOverlays();
		$('ability-bar').classList.remove('disabled');
		$('debuff').style.display = 'block';
		$('objective').style.opacity = 1;
		$('objective').textContent = 'Protect Teron!\nKill all 4 constructs before any reaches him.';
		$('announce').textContent = '';
		this.bossRing.visible = true;
		this.refreshBindLabels();
		this.setTarget(null);

		this.audio.startLoops();
		this.audio.play('aggro', 0.3);
	}

	toMenu() {
		this.state = 'menu';
		$('debuff').style.display = 'none';
		$('ability-bar').classList.add('disabled');
		this.setTarget(null);
		$('start-overlay').style.display = 'flex';
		const records = loadRecords();
		const line = mode => (records[mode] && records[mode].length) ? formatTime(records[mode][0]) : '—';
		$('best-line').textContent = 'Best times — Normal: ' + line('normal3d') + '   Practice: ' + line('practice3d');
	}

	togglePause() {
		if (this.state === 'paused') {
			this.state = this.pausedFrom;
			$('pause-overlay').style.display = 'none';
			this.held = { moveUp: false, moveDown: false, moveLeft: false, moveRight: false };
			this.audio.resumeLoops();
		} else if (this.state === 'prep' || this.state === 'fight') {
			this.pausedFrom = this.state;
			this.state = 'paused';
			$('pause-overlay').style.display = 'flex';
			this.audio.pauseLoops();
		}
	}

	// -------------------------------------------------- targeting

	aliveGhosts() {
		return this.ghosts.filter(g => g.alive && g.visible);
	}

	setTarget(ghost) {
		this.target = ghost;
		$('target-frame').style.display = ghost ? 'block' : 'none';
		if (ghost) $('tf-name').textContent = ghost.name;
	}

	selectNextTarget(reverse) {
		const alive = this.aliveGhosts();
		const next = reverse
			? this.cycler.prev(alive, this.player, this.target)
			: this.cycler.next(alive, this.player, this.target);
		this.setTarget(next ?? null);
	}

	// -------------------------------------------------- abilities

	isGCD() { return this.simTime - this.lastGcdAt < GCD_MS; }

	cooldownRemaining(slot) {
		if (this.cheatNoCooldowns || !slot.ability.cooldownMs) return 0;
		return Math.max(0, slot.ability.cooldownMs - (this.simTime - slot.lastCastAt));
	}

	dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

	inRange(target, rangeYards) {
		return this.dist(this.player, target) <= rangeYards * PX_PER_YARD;
	}

	resolveTarget() {
		if (this.settings.mouseoverCast && this.hoveredGhost && this.hoveredGhost.alive) return this.hoveredGhost;
		if (this.target && this.target.alive) return this.target;
		if (this.settings.autoTargetNearest) {
			const near = nearest(this.aliveGhosts(), this.player);
			if (near) { this.setTarget(near); return near; }
		}
		return null;
	}

	tryActivate(slotIndex) {
		if (this.state !== 'fight') return;
		const slot = this.slots[slotIndex];
		const ability = slot.ability;
		slot.pressedUntil = this.simTime + 150;

		if (this.isGCD()) return;
		if (this.cooldownRemaining(slot) > 0) { this.showError('Not ready yet'); return; }

		if (ability.type === 'target') {
			const target = this.resolveTarget();
			if (!target) { this.showError('No target'); return; }
			if (!this.inRange(target, ability.rangeYards)) { this.showError('Out of range'); return; }
			this.audio.play(ability.id + '_Cast');
			if (ability.lanceFx) this.fireProjectile(target, ability.projSpeed);
			this.queueImpact(target, ability);
		} else if (ability.type === 'aoe') {
			this.audio.play(ability.id + '_Cast');
			if (ability.nova) this.fireNova();
			for (const ghost of this.aliveGhosts()) {
				if (this.inRange(ghost, ability.rangeYards)) {
					if (ability.lanceFx) this.fireProjectile(ghost, ability.projSpeed);
					this.queueImpact(ghost, ability);
				}
			}
			slot.lastCastAt = this.simTime;
		}
		// flavor (Spirit Shield): announce + GCD only

		this.announce(ability.name);
		this.lastGcdAt = this.simTime;
	}

	queueImpact(ghost, ability) {
		const travelMs = (this.dist(this.player, ghost) / ability.projSpeed) * 1000;
		this.impacts.push({ at: this.simTime + travelMs, ghost, ability });
	}

	applyImpact(ghost, ability) {
		if (!ghost.alive) return;
		const damage = Math.min((ability.dmg[0] + ability.dmg[1]) / 2, ghost.hp);
		ghost.hp -= damage;
		ghost.frozen = false; // any damage breaks freeze
		if (ability.slow) {
			if (ghost.lanceStacks < GHOST.maxLanceStacks) {
				ghost.lanceStacks += 1;
				ghost.currentSpeed -= GHOST.lanceSlowPerStack * ghost.maxSpeed;
			}
			ghost.lancedAt = this.simTime;
			ghost.mat.color.set(0x7b91f1);
		}
		if (ability.freeze && ghost.hp > 0) {
			ghost.frozen = true;
			ghost.frozenAt = this.simTime;
		}
		this.audio.play(ability.id + '_Impact');
		if (ghost.hp <= 0) this.killGhost(ghost);
	}

	killGhost(ghost) {
		ghost.alive = false;
		this.audio.play('ghostDeath');
		ghost.deathFadeStart = this.simTime;
		if (this.target === ghost) this.setTarget(null);
	}

	fireProjectile(ghost, speed) {
		const mesh = new THREE.Mesh(
			new THREE.SphereGeometry(3.5, 8, 8),
			new THREE.MeshBasicMaterial({ color: 0x77bbff })
		);
		mesh.position.copy(to3D(this.player.x, this.player.y)).setY(12);
		this.scene.add(mesh);
		this.projectiles.push({
			mesh, ghost,
			fromX: this.player.x, fromY: this.player.y,
			start: this.simTime,
			dur: (this.dist(this.player, ghost) / speed) * 1000,
		});
	}

	fireNova() {
		const mesh = this.makeRing(6, 0x77bbff, 0.8);
		mesh.position.copy(to3D(this.player.x, this.player.y)).setY(1);
		this.scene.add(mesh);
		this.novas.push({ mesh, start: this.simTime, dur: 514 });
	}

	// -------------------------------------------------- sim update

	frame(now) {
		const dt = Math.min(50, now - this.lastFrame);
		this.lastFrame = now;
		if (this.state === 'prep' || this.state === 'fight') {
			this.simTime += dt;
			this.simUpdate(dt / 1000);
		}
		this.syncVisuals(now);
		this.updateHudFrame();
		this.renderer.render(this.scene, this.camera);
		requestAnimationFrame(t => this.frame(t));
	}

	simUpdate(dtSec) {
		this.movePlayer(dtSec);

		if (this.state === 'prep') {
			if (this.simTime >= this.prepEndsAt) this.spawnGhosts();
			return;
		}

		// impacts + scheduled sounds
		for (const impact of this.impacts.filter(i => this.simTime >= i.at)) this.applyImpact(impact.ghost, impact.ability);
		this.impacts = this.impacts.filter(i => this.simTime < i.at);
		for (const s of this.scheduled.filter(s => this.simTime >= s.at)) s.fn();
		this.scheduled = this.scheduled.filter(s => this.simTime < s.at);

		for (const ghost of this.ghosts) this.updateGhost(ghost, dtSec);

		this.playRandomBark();

		if (this.ghostSpawnAt != null && this.ghosts.every(g => !g.alive)) this.winGame();
		else if (!this.cheatNoLose && this.ghosts.some(g => g.alive && g.visible && this.dist(g, BOSS_POS) < BOSS_LOSE_RANGE)) this.loseGame();
	}

	movePlayer(dtSec) {
		let vx = 0, vy = 0;
		if (this.held.moveLeft) vx = -1;
		else if (this.held.moveRight) vx = 1;
		if (this.held.moveUp) vy = -1;
		else if (this.held.moveDown) vy = 1;

		if (vx || vy) {
			this.moveTarget = null;
			const len = Math.hypot(vx, vy);
			this.tryMove((vx / len) * PLAYER_SPEED * dtSec, (vy / len) * PLAYER_SPEED * dtSec);
			return;
		}
		if (this.moveTarget) {
			const d = this.dist(this.player, this.moveTarget);
			if (d < 8 && !this.followPointer) { this.moveTarget = null; return; }
			if (d > 0.001) {
				const stepLen = Math.min(d, PLAYER_SPEED * dtSec);
				this.tryMove(
					((this.moveTarget.x - this.player.x) / d) * stepLen,
					((this.moveTarget.y - this.player.y) / d) * stepLen
				);
			}
		}
	}

	// Axis-separated move with wall + bounds collision (circle r=8 vs rects).
	tryMove(dx, dy) {
		const r = 8;
		const collides = (x, y) => WALLS.some(([wx, wy, w, h]) =>
			Math.abs(x - wx) < w / 2 + r && Math.abs(y - wy) < h / 2 + r);
		let nx = Math.min(600 - r, Math.max(r, this.player.x + dx));
		if (!collides(nx, this.player.y)) this.player.x = nx;
		let ny = Math.min(800 - r, Math.max(r, this.player.y + dy));
		if (!collides(this.player.x, ny)) this.player.y = ny;
	}

	spawnGhosts() {
		this.state = 'fight';
		this.ghostSpawnAt = this.simTime;
		const off = GHOST.spawnOffset;
		const positions = [
			[this.player.x - off, this.player.y - off], [this.player.x + off, this.player.y - off],
			[this.player.x - off, this.player.y + off], [this.player.x + off, this.player.y + off],
		];
		this.ghosts.forEach((g, i) => {
			g.x = positions[i][0]; g.y = positions[i][1];
			g.visible = true; g.spawnAt = this.simTime;
			g.sprite.visible = true;
		});

		// player becomes a ghost
		this.playerMat.color.set(0xbfe8ff);
		this.playerMat.emissive.set(0x5588cc);
		this.playerMat.transparent = true;
		this.playerMat.opacity = 0.8;

		$('debuff').style.display = 'none';
		this.audio.play('ghostSpawn');
		this.scheduled.push({ at: this.simTime + 4000, fn: () => this.hideObjective() });
	}

	hideObjective() {
		$('objective').style.opacity = 0;
		this.bossRing.visible = false;
	}

	updateGhost(ghost, dtSec) {
		if (!ghost.visible || !ghost.alive) return;

		if (ghost.frozen && this.simTime - ghost.frozenAt >= GHOST.freezeMs) ghost.frozen = false;
		if (ghost.lanceStacks > 0 && this.simTime - ghost.lancedAt >= GHOST.lanceMs) {
			ghost.lanceStacks = 0;
			ghost.currentSpeed = ghost.maxSpeed;
			ghost.mat.color.set(0xffffff);
		}

		if (this.simTime - ghost.spawnAt < GHOST.spawnGraceMs) return;
		if (ghost.frozen) return;

		const inCorridor = (ghost.x >= CORRIDOR.minX && ghost.x <= CORRIDOR.maxX) || ghost.y <= CORRIDOR.maxY;
		const target = inCorridor ? BOSS_POS : DOORWAY_POS;
		const d = this.dist(ghost, target);
		if (d > 0.001) {
			const stepLen = Math.min(d, ghost.currentSpeed * dtSec);
			ghost.x += ((target.x - ghost.x) / d) * stepLen;
			ghost.y += ((target.y - ghost.y) / d) * stepLen;
		}
	}

	playRandomBark() {
		if (this.simTime < this.barkBlockUntil) return;
		if (this.simTime - this.lastBarkCheckAt < 1000) return;
		this.lastBarkCheckAt = this.simTime;
		const barks = ['bark1', 'bark2', 'bark3', 'bark4'];
		if (barks.some(b => this.audio.isPlaying(b))) return;
		const bark = barks[Math.floor(Math.random() * barks.length)];
		if (bark === this.lastBark) return;
		if (Math.random() < 0.2) {
			this.audio.play(bark);
			this.lastBark = bark;
		}
	}

	winGame() {
		this.state = 'won';
		const seconds = (this.simTime - this.ghostSpawnAt) / 1000;
		this.audio.play('teronDeath', 1.3);
		this.hideObjective();
		this.setTarget(null);

		// You defend Teron from the constructs; you don't kill him.
		$('end-title').textContent = 'All constructs defeated!';
		$('end-title').className = 'win';
		$('btn-retry').textContent = 'Play Again';
		$('end-hint').textContent = 'Press R to play again';
		$('end-flavour').textContent = 'Your raid members cheer at you! You saved their day!';
		$('end-flavour').style.display = 'block';

		const time = $('end-time');
		const cheated = this.cheatNoLose || this.cheatNoCooldowns;
		if (cheated) {
			time.textContent = 'You "won" in ' + formatTime(seconds) + '...';
			time.style.color = '#666666';
			$('end-cheat').style.display = 'block';
			$('end-best').textContent = '';
			$('end-record').style.display = 'none';
		} else {
			time.textContent = 'You won in ' + formatTime(seconds) + '! Can you beat your friends?';
			time.style.color = parseTier(seconds).color;
			$('end-cheat').style.display = 'none';
			const { best, isRecord } = addRecord(this.recordMode, seconds);
			$('end-best').textContent = 'Personal best: ' + formatTime(best);
			$('end-record').style.display = isRecord ? 'block' : 'none';
		}
		$('end-overlay').style.display = 'flex';
	}

	loseGame() {
		this.state = 'lost';
		this.audio.play('enrage', 0.75);
		this.hideObjective();
		this.setTarget(null);

		$('end-title').textContent = 'Your raid leader audibly sighs...';
		$('end-title').className = 'red';
		$('btn-retry').textContent = 'Try Again';
		$('end-hint').textContent = 'Press R to try again';
		$('end-flavour').textContent = "Ok wipe it up. This isn't hard just.. ugh. Didn't you all " +
			"practice this? Run back asap and let's hope you-know-who doesn't get Shadow of Death this time..";
		$('end-flavour').style.display = 'block';
		$('end-time').textContent = '';
		$('end-cheat').style.display = 'none';
		$('end-best').textContent = '';
		$('end-record').style.display = 'none';
		$('end-overlay').style.display = 'flex';
	}

	// -------------------------------------------------- render sync

	syncVisuals(now) {
		const playerV = to3D(this.player?.x ?? 245, this.player?.y ?? 152);
		this.playerMesh.position.copy(playerV).setY(8);

		// chase camera, north-up
		this.camera.position.set(playerV.x, 330 * this.camZoom, playerV.z + 260 * this.camZoom);
		this.camera.lookAt(playerV.x, 10, playerV.z - 40);

		// boss objective ring pulse
		if (this.bossRing.visible) {
			const s = 1 + 0.25 * Math.sin(now / 260);
			this.bossRing.scale.set(s, s, 1);
		}
		this.bossMesh.rotation.y = now / 900;

		for (const ghost of this.ghosts) {
			if (!ghost.visible) continue;
			ghost.sprite.position.copy(to3D(ghost.x, ghost.y)).setY(2);
			ghost.freezeRing.visible = ghost.alive && ghost.frozen;
			if (ghost.freezeRing.visible) ghost.freezeRing.position.copy(to3D(ghost.x, ghost.y)).setY(0.4);
			if (!ghost.alive) {
				const fade = 1 - Math.min(1, (this.simTime - ghost.deathFadeStart) / 300);
				ghost.mat.opacity = fade;
				if (fade <= 0) { ghost.visible = false; ghost.sprite.visible = false; }
			}
		}

		this.targetRing.visible = !!(this.target && this.target.alive && this.target.visible);
		if (this.targetRing.visible) this.targetRing.position.copy(to3D(this.target.x, this.target.y)).setY(0.5);

		// Re-raycast each frame: ghosts move under a stationary cursor, so a
		// hover cached from the last pointermove goes stale mid-fight.
		if (this.state === 'fight') this.updateHover();
		const showHover = this.settings.mouseoverCast && this.hoveredGhost &&
			this.hoveredGhost.alive && this.hoveredGhost !== this.target;
		this.hoverRing.visible = !!showHover;
		if (showHover) this.hoverRing.position.copy(to3D(this.hoveredGhost.x, this.hoveredGhost.y)).setY(0.6);

		for (const p of [...this.projectiles]) {
			const t = Math.min(1, (this.simTime - p.start) / p.dur);
			const x = p.fromX + (p.ghost.x - p.fromX) * t;
			const y = p.fromY + (p.ghost.y - p.fromY) * t;
			p.mesh.position.copy(to3D(x, y)).setY(12);
			if (t >= 1) { this.scene.remove(p.mesh); this.projectiles.splice(this.projectiles.indexOf(p), 1); }
		}
		for (const n of [...this.novas]) {
			const t = Math.min(1, (this.simTime - n.start) / n.dur);
			const s = 1 + t * 22;
			n.mesh.scale.set(s, s, 1);
			n.mesh.material.opacity = 0.8 * (1 - t);
			if (t >= 1) { this.scene.remove(n.mesh); this.novas.splice(this.novas.indexOf(n), 1); }
		}
	}

	updateHudFrame() {
		if (this.state === 'prep') {
			$('debuff').querySelector('.timer').textContent = Math.max(0, Math.ceil((this.prepEndsAt - this.simTime) / 1000));
		}

		const gcd = this.isGCD();
		let coachSlot = -1;
		if (this.state === 'fight' && this.settings.abilityCoach) {
			const alive = this.aliveGhosts();
			coachSlot = recommendSlot({
				player: { x: this.player.x, y: this.player.y },
				ghosts: alive.map(g => ({
					x: g.x, y: g.y, lanceStacks: g.lanceStacks,
					lanceRemainMs: Math.max(0, GHOST.lanceMs - (this.simTime - g.lancedAt)),
				})),
				targetIndex: alive.indexOf(this.target),
				ready: this.slots.map(s => this.cooldownRemaining(s) === 0),
			});
		}
		for (const slot of this.slots) {
			const cdMs = this.cooldownRemaining(slot);
			slot.div.classList.toggle('cooling', (gcd || cdMs > 0) && this.state === 'fight');
			slot.div.classList.toggle('pressed', this.simTime < slot.pressedUntil);
			slot.div.classList.toggle('coach', slot.ability.slot === coachSlot);
			slot.cdEl.style.display = cdMs > 0 ? 'flex' : 'none';
			if (cdMs > 0) slot.cdEl.textContent = Math.ceil(cdMs / 1000);
		}

		if (this.target && this.target.alive) {
			const pct = this.target.hp / GHOST.maxHP;
			$('tf-hpfill').style.width = (pct * 100) + '%';
			$('tf-hpfill').style.background = pct > 0.5 ? '#008a00' : (pct > 0.25 ? '#8a8a00' : '#8a0000');
			$('tf-pct').textContent = Math.ceil(pct * 100) + '%';

			const lanceMs = Math.max(0, GHOST.lanceMs - (this.simTime - this.target.lancedAt));
			const lanceEl = $('tf-lance');
			lanceEl.style.display = this.target.lanceStacks > 0 && lanceMs > 0 ? 'flex' : 'none';
			lanceEl.querySelector('span').textContent = this.target.lanceStacks + '× ' + Math.ceil(lanceMs / 1000) + 's';

			const chainsMs = Math.max(0, GHOST.freezeMs - (this.simTime - this.target.frozenAt));
			const chainsEl = $('tf-chains');
			chainsEl.style.display = this.target.frozen && chainsMs > 0 ? 'flex' : 'none';
			chainsEl.querySelector('span').textContent = Math.ceil(chainsMs / 1000) + 's';
		} else if (this.target) {
			this.setTarget(null);
		}
	}
}

window.g3d = new Game3D();
