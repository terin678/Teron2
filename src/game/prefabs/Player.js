import { PLAYER_SPEED } from '../../core/constants.js';

export class Player extends Phaser.GameObjects.Image {

	constructor(scene, x, y) {
		super(scene, x, y, 'balls', 0);
		this.setTint(0xfe8884);
		scene.physics.add.existing(this);
		this.body.setCollideWorldBounds(true);

		this.movementSpeed = PLAYER_SPEED;
		this.moveTarget = null;
		this.followTarget = false;
	}

	setMoveTarget(newMoveTarget, followTarget) {
		if (newMoveTarget == null) {
			this.moveTarget = null;
			this.followTarget = false;
			return;
		}
		if (followTarget) {
			// Keep chasing the live pointer as it moves.
			this.moveTarget = newMoveTarget;
			this.followTarget = true;
		} else {
			this.moveTarget = { x: newMoveTarget.x, y: newMoveTarget.y };
			this.followTarget = false;
		}
	}

	changeToGhost() {
		this.setFrame(2);
		this.setTint(0xf097ff);
	}

	stopMoving() {
		this.body.setVelocity(0, 0);
		this.setMoveTarget(null);
	}

	// held: { moveUp, moveDown, moveLeft, moveRight } booleans
	movePlayer(held) {
		if (held.moveLeft) this.body.setVelocityX(-this.movementSpeed);
		else if (held.moveRight) this.body.setVelocityX(this.movementSpeed);
		else this.body.setVelocityX(0);

		if (held.moveDown) this.body.setVelocityY(this.movementSpeed);
		else if (held.moveUp) this.body.setVelocityY(-this.movementSpeed);
		else this.body.setVelocityY(0);

		if (this.moveTarget != null) {
			const hasKeyboardInput = held.moveUp || held.moveDown || held.moveLeft || held.moveRight;
			if (hasKeyboardInput) {
				// Keyboard overrides click-to-move.
				this.setMoveTarget(null);
				return;
			}
			const distance = Phaser.Math.Distance.BetweenPoints(this, this.moveTarget);
			if (distance < 8 && !this.followTarget) {
				this.setMoveTarget(null);
				this.body.setVelocity(0, 0);
			} else {
				this.scene.physics.moveToObject(this, this.moveTarget, this.movementSpeed);
			}
		}
	}
}
