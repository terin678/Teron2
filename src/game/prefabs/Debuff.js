// Shadow of Death debuff icon + countdown. Uses scene time so pause freezes it.
export class Debuff extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x, y);

		const icon = scene.add.image(11, 0, 'debuff_shadowOfDeath');
		this.add(icon);

		this.timerText = scene.add.text(-16, 35, '', {
			align: 'center', fixedWidth: 56, fontSize: '24px', fontStyle: 'bold',
		});
		this.add(this.timerText);

		this.endTime = null;
		this.pendingSeconds = null;
		this.heldText = null;
	}

	// Freeze the countdown at a fixed display value (tutorial "the timer waits
	// for you" phase). A later setRemainingSeconds() releases the hold.
	holdAt(seconds) {
		this.heldText = String(seconds);
		this.pendingSeconds = null;
		this.endTime = null;
	}

	// scene.time.now is not valid until the first update tick, so the deadline
	// is fixed lazily on the first update() call.
	setRemainingSeconds(seconds) {
		this.heldText = null;
		this.pendingSeconds = seconds;
		this.endTime = null;
	}

	update() {
		if (this.heldText != null) {
			this.timerText.setText(this.heldText);
			return;
		}
		if (this.endTime == null) {
			if (this.pendingSeconds == null) return;
			this.endTime = this.scene.time.now + this.pendingSeconds * 1000;
			this.pendingSeconds = null;
		}
		const remaining = Math.ceil((this.endTime - this.scene.time.now) / 1000);
		if (remaining <= 0) {
			this.visible = false;
		} else {
			this.timerText.setText(String(remaining));
		}
	}
}
