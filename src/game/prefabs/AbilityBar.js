import { ABILITIES, GCD_MS, PX_PER_YARD } from '../../core/constants.js';
import { bindLabel } from '../../core/settings.js';
import { nearest } from '../../core/targeting.js';

const SLOT_X = [-8, 104, 160, 216, 328]; // original possess-bar layout, with gaps
const COOLING_TINT = 0x444444;
const READY_TINT = 0xffffff;

export class AbilityBar extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x, y);

		this.slots = [];
		for (const ability of ABILITIES) {
			const sx = SLOT_X[ability.slot];
			const icon = scene.add.image(sx, 24, ability.icon).setInteractive();
			const frame = scene.add.image(sx, 24, 'spellFrame');
			frame.visible = false;
			const bindText = scene.add.text(sx - 20, -4, '', {
				color: '#ffffff', fontSize: '20px', stroke: '#000000', strokeThickness: 5,
			});
			const cooldownText = scene.add.text(sx - 28, 4, '', {
				align: 'center', color: '#ff0000', fixedWidth: 56, fontSize: '36px',
				fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
			});
			cooldownText.visible = false;
			this.add([icon, frame, bindText, cooldownText]);

			const slot = { ability, icon, frame, bindText, cooldownText, lastCastAt: -Infinity, mouseIsOver: false, pressedUntil: 0 };
			icon.on('pointerdown', () => this.tryActivate(ability.slot));
			icon.on('pointerover', () => { slot.mouseIsOver = true; });
			icon.on('pointerout', () => { slot.mouseIsOver = false; });
			this.slots.push(slot);
		}

		// Rotation-coach highlight: additive halo + frame + bouncing arrow on the
		// recommended next ability. Deliberately loud — it's training wheels.
		this.coachHalo = scene.add.image(0, 24, 'spellFrame').setTint(0xffd21f);
		this.coachHalo.setBlendMode(Phaser.BlendModes.ADD);
		this.coachHalo.setScale(1.35);
		this.add(this.coachHalo);
		scene.tweens.add({
			targets: this.coachHalo,
			alpha: 0.25,
			scaleX: 1.6, scaleY: 1.6,
			duration: 450,
			yoyo: true,
			repeat: -1,
		});

		this.coachGlow = scene.add.image(0, 24, 'spellFrame').setTint(0xffd21f);
		this.add(this.coachGlow);
		scene.tweens.add({
			targets: this.coachGlow,
			alpha: 0.5,
			duration: 450,
			yoyo: true,
			repeat: -1,
		});

		this.coachArrow = scene.add.text(0, -38, '▼', {
			color: '#ffd21f', fontSize: '34px', fontStyle: 'bold',
			stroke: '#000000', strokeThickness: 5,
		}).setOrigin(0.5, 0.5);
		this.add(this.coachArrow);
		scene.tweens.add({
			targets: this.coachArrow,
			y: -24,
			duration: 380,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.easeInOut',
		});

		this.coachParts = [this.coachHalo, this.coachGlow, this.coachArrow];
		for (const part of this.coachParts) part.visible = false;

		// Announcement of the last cast (left of the bar, like the original)
		this.abilityName = scene.add.text(-288, 12, '', { fontSize: '24px', fontStyle: 'bold' });
		this.abilityName.visible = false;
		this.add(this.abilityName);

		// Error feedback ("Out of range" etc.), centered above the bar
		this.errorText = scene.add.text(160, -40, '', {
			color: '#ff4444', fontSize: '26px', fontStyle: 'bold',
			stroke: '#000000', strokeThickness: 4,
		}).setOrigin(0.5, 0.5);
		this.errorText.visible = false;
		this.add(this.errorText);

		this.lastGcdAt = -Infinity;
		this.nocooldowns = false;
		this.gameEnded = false;
		// Slots whose bound key is currently held down; maintained by the scene.
		this.heldSlots = new Set();
		// An ability pressed during the global cooldown fires the moment it ends,
		// the way WoW's spell queue does. Without it a press inside the 1s GCD is
		// silently dropped, which reads as the button not working.
		this.queuedSlot = null;

		// wired up by the scene after construction:
		this.player = null;
		this.ghosts = null;
		this.targetFrame = null;
		this.getHoveredGhost = () => null;
		this.settings = null;

		this.castSounds = {};
		for (const ability of ABILITIES) {
			if (ability.castSound) this.castSounds[ability.id] = scene.sound.add(ability.castSound, { volume: 0.3 });
			if (ability.impactSound) scene.sound.add(ability.impactSound, { volume: 0.25 });
		}
	}

	get now() {
		return this.scene.time.now;
	}

	refreshBindLabels() {
		for (const slot of this.slots) {
			const binds = this.settings.binds['ability' + slot.ability.slot];
			slot.bindText.setText(bindLabel(binds?.[0] ?? binds?.[1] ?? null));
		}
	}

	isGCD() {
		return (this.now - this.lastGcdAt) < GCD_MS;
	}

	setGCD() {
		this.lastGcdAt = this.now;
	}

	cooldownRemaining(slot) {
		if (this.nocooldowns || !slot.ability.cooldownMs) return 0;
		return Math.max(0, slot.ability.cooldownMs - (this.now - slot.lastCastAt));
	}

	update() {
		if (!this.visible) return;

		// Release a queued press the instant the global cooldown clears.
		if (this.queuedSlot !== null && !this.isGCD()) {
			const slot = this.queuedSlot;
			this.queuedSlot = null;
			if (!this.gameEnded) this.tryActivate(slot);
		}

		const gcd = this.isGCD();
		for (const slot of this.slots) {
			const cdMs = this.cooldownRemaining(slot);
			slot.icon.setTint(gcd || cdMs > 0 ? COOLING_TINT : READY_TINT);
			slot.cooldownText.visible = cdMs > 0;
			if (cdMs > 0) slot.cooldownText.setText(String(Math.ceil(cdMs / 1000)));
			// Lit for as long as the key is held (as the original did), plus a
			// short flash so a quick tap still registers visually.
			slot.frame.visible = this.heldSlots.has(slot.ability.slot) ||
				this.now < slot.pressedUntil ||
				(this.scene.input.activePointer.isDown && slot.mouseIsOver);
		}
	}

	setCoachSlot(slotIndex) {
		const show = slotIndex != null && slotIndex >= 0 && this.visible;
		for (const part of this.coachParts) part.visible = show;
		if (show) {
			this.coachHalo.x = SLOT_X[slotIndex];
			this.coachGlow.x = SLOT_X[slotIndex];
			this.coachArrow.x = SLOT_X[slotIndex];
		}
	}

	showPressed(slotIndex) {
		this.slots[slotIndex].pressedUntil = this.now + 150;
	}

	feedback(message) {
		this.errorText.setText(message);
		this.errorText.visible = true;
		this.errorText.alpha = 1;
		this.scene.tweens.killTweensOf(this.errorText);
		this.scene.tweens.add({
			targets: this.errorText,
			alpha: 0,
			delay: 700,
			duration: 400,
			onComplete: () => { this.errorText.visible = false; },
		});
	}

	announce(name) {
		this.abilityName.setText(name);
		this.abilityName.visible = true;
	}

	aliveGhosts() {
		return this.ghosts.filter(g => g.alive);
	}

	// Resolve who a single-target ability should hit:
	// mouseover (if enabled and hovering) > selected target > auto-target nearest.
	resolveTarget() {
		if (this.settings.mouseoverCast) {
			const hovered = this.getHoveredGhost();
			if (hovered && hovered.alive) return { target: hovered, mouseover: true };
		}
		if (this.targetFrame.target && this.targetFrame.target.alive) {
			return { target: this.targetFrame.target, mouseover: false };
		}
		if (this.settings.autoTargetNearest) {
			const near = nearest(this.aliveGhosts(), this.player);
			if (near) {
				this.targetFrame.setTarget(near); // WoW auto-target selects it
				return { target: near, mouseover: false };
			}
		}
		return { target: null, mouseover: false };
	}

	tryActivate(slotIndex) {
		if (this.gameEnded || !this.visible) return;
		const slot = this.slots[slotIndex];
		const ability = slot.ability;
		this.showPressed(slotIndex);

		if (this.isGCD()) {
			this.queuedSlot = slotIndex;
			return;
		}
		if (this.cooldownRemaining(slot) > 0) {
			this.feedback('Not ready yet');
			return;
		}

		if (ability.type === 'target') {
			const { target } = this.resolveTarget();
			if (!target) {
				this.feedback('No target');
				return;
			}
			if (!this.isInRange(this.player, target, ability.rangeYards)) {
				this.feedback('Out of range');
				return;
			}
			this.castSounds[ability.id]?.play();
			if (ability.lanceFx) this.fireLance(this.player, target, ability.projSpeed);
			this.applyDelayed(this.player, target, ability.projSpeed, ability);
		} else if (ability.type === 'aoe') {
			this.castSounds[ability.id]?.play();
			if (ability.nova) this.fireNova(this.player);
			for (const ghost of this.aliveGhosts()) {
				if (this.isInRange(this.player, ghost, ability.rangeYards)) {
					if (ability.lanceFx) this.fireLance(this.player, ghost, ability.projSpeed);
					this.applyDelayed(this.player, ghost, ability.projSpeed, ability);
				}
			}
			slot.lastCastAt = this.now;
		}
		// flavor abilities (Spirit Shield) just announce + GCD

		this.announce(ability.name);
		this.setGCD();
		this.scene.events.emit('ability-cast', ability.id);
	}

	applyDelayed(source, target, speed, ability) {
		const travelMs = this.travelTime(source, target, speed) * 1000;
		this.scene.time.delayedCall(travelMs, () => {
			if (!target.alive) return;
			target.applyDamage(ability.dmg[0], ability.dmg[1]);
			if (ability.slow) target.applyLance();
			if (ability.freeze && target.alive) target.applyFreeze();
			if (ability.impactSound) this.scene.sound.play(ability.impactSound, { volume: 0.25 });
		});
	}

	isInRange(player, target, rangeYards) {
		const rangePx = rangeYards * PX_PER_YARD;
		return Phaser.Math.Distance.BetweenPoints(player, target) <= rangePx;
	}

	travelTime(source, target, speed) {
		return Phaser.Math.Distance.BetweenPoints(source, target) / speed;
	}

	fireLance(source, target, speed) {
		const angle = Phaser.Math.Angle.Between(target.x, target.y, source.x, source.y) / Phaser.Math.DEG_TO_RAD;
		const particles = this.scene.add.particles(source.x, source.y, 'blueFlare', {
			speed: { min: -500, max: 100 },
			angle,
			gravityY: 0,
			scale: { start: 0.1, end: 0 },
			quantity: 1,
			lifespan: 200,
			blendMode: 'ADD',
		});
		this.scene.tweens.add({
			targets: particles,
			x: target.x,
			y: target.y,
			ease: 'Linear',
			duration: this.travelTime(source, target, speed) * 1000,
			onComplete: () => particles.destroy(),
		});
	}

	fireNova(source) {
		const particles = this.scene.add.particles(source.x, source.y, 'blueFlare', {
			speed: 270,
			blendMode: 'ADD',
			lifespan: 514,
			quantity: 10,
			scale: { start: 0.0, end: 0.5 },
		});
		particles.setDepth(-1);
		this.scene.time.delayedCall(514, () => particles.destroy());
	}
}
