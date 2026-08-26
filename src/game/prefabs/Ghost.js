import { GHOST, BOSS_POS, DOORWAY_POS, CORRIDOR } from '../../core/constants.js';

const WHITE_TINT = 0xffffff;
const LANCE_TINT = 0x7b91f1;

export class Ghost extends Phaser.GameObjects.Image {

	constructor(scene, x, y, name) {
		super(scene, x, y, 'ghost_transparent');
		this.setScale(0.15);
		this.ghostName = name;
		this.visible = false;

		scene.physics.add.existing(this);

		this.speedMult = 1.0;
		this.maxSpeed = GHOST.speed;
		this.currentSpeed = this.maxSpeed;

		this.alive = true;
		this.spawnTime = null;

		this.maxHP = GHOST.maxHP;
		this.currentHP = this.maxHP;

		this.frozen = false;
		this.frozenAt = -Infinity;
		this.lancedAt = -Infinity;
		this.lanceStacks = 0;

		// Enlarged hit area (in texture space) so click/mouseover targeting
		// is forgiving — the visible sprite is only ~30px on screen.
		const r = Math.max(this.width, this.height) * 0.7;
		this.setInteractive(
			new Phaser.Geom.Circle(this.width / 2, this.height / 2, r),
			Phaser.Geom.Circle.Contains
		);

		this.deathSound = scene.sound.add('ghost_Death', { volume: 0.3 });
	}

	get now() {
		return this.scene.time.now;
	}

	spawn(x, y, speedMult) {
		this.x = x;
		this.y = y;
		this.speedMult = speedMult;
		this.maxSpeed = GHOST.speed * speedMult;
		this.currentSpeed = this.maxSpeed;
		this.spawnTime = this.now;
		this.visible = true;
	}

	update() {
		if (!this.visible || !this.alive) return;
		this.moveGhost();
		this.checkDebuffs();
	}

	frozenTimeRemaining() {
		return Math.max(0, GHOST.freezeMs - (this.now - this.frozenAt));
	}

	lanceTimeRemaining() {
		return Math.max(0, GHOST.lanceMs - (this.now - this.lancedAt));
	}

	unfreeze() {
		this.frozen = false;
	}

	applyLance() {
		if (this.lanceStacks < GHOST.maxLanceStacks) {
			this.lanceStacks += 1;
			this.currentSpeed -= GHOST.lanceSlowPerStack * this.maxSpeed;
		}
		this.lancedAt = this.now; // refresh duration
		this.setTint(LANCE_TINT);
	}

	applyFreeze() {
		this.frozen = true;
		this.frozenAt = this.now;
	}

	applyDamage(minDamage, maxDamage) {
		let damage = (minDamage + maxDamage) / 2;
		if (damage > this.currentHP) damage = this.currentHP;
		this.currentHP -= damage;

		this.unfreeze(); // any damage removes freeze

		if (this.currentHP <= 0) this.die();
	}

	die() {
		this.alive = false;
		this.deathSound.play({ delay: 0.1 });
		this.body.setVelocity(0, 0);
		this.scene.tweens.add({
			targets: this,
			alpha: 0,
			duration: 300,
			ease: 'Power2',
			onComplete: () => { this.visible = false; },
		});
	}

	stopMoving() {
		this.body.setVelocity(0, 0);
	}

	checkDebuffs() {
		if (this.frozen && this.frozenTimeRemaining() === 0) {
			this.unfreeze();
		}
		if (this.lanceStacks > 0 && this.lanceTimeRemaining() === 0) {
			this.currentSpeed = this.maxSpeed;
			this.lanceStacks = 0;
			this.setTint(WHITE_TINT);
		}
	}

	moveGhost() {
		if (this.now - this.spawnTime < GHOST.spawnGraceMs) {
			return; // grace period after spawning
		}

		const inCorridor = (this.x >= CORRIDOR.minX && this.x <= CORRIDOR.maxX) || this.y <= CORRIDOR.maxY;
		const target = inCorridor ? BOSS_POS : DOORWAY_POS;

		this.scene.physics.moveToObject(this, target, this.frozen ? 0 : this.currentSpeed);
	}
}
