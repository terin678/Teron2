// WoW-style target frame: name, HP bar/percent, lance + chains debuff timers.
export class TargetFrame extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x, y);

		const frame = scene.add.image(70, -2, 'targetFrame').setOrigin(0, 0);
		this.add(frame);

		this.hpBackground = scene.add.rectangle(73, 23, 130, 22).setOrigin(0, 0);
		this.hpBackground.isFilled = true;
		this.hpBackground.fillColor = 0x6f9066;
		this.add(this.hpBackground);

		this.hpForeground = scene.add.rectangle(73, 23, 130, 22).setOrigin(0, 0);
		this.hpForeground.isFilled = true;
		this.hpForeground.fillColor = 0x008a00;
		this.add(this.hpForeground);

		this.targetName = scene.add.text(95, 3, '', { fontFamily: 'Arial Narrow', fontSize: '11px' });
		this.add(this.targetName);

		this.hpPercentage = scene.add.text(205, 28, '', { fontFamily: 'Arial', fontSize: '10px' });
		this.add(this.hpPercentage);

		this.lanceIcon = scene.add.image(227, 73, 'spell_spiritLance').setScale(0.5);
		this.add(this.lanceIcon);

		this.chainsIcon = scene.add.image(197, 73, 'spell_spiritChains').setScale(0.5);
		this.add(this.chainsIcon);

		this.chainsTimer = scene.add.text(183, 88, '', {
			align: 'center', fixedWidth: 56, fontSize: '24px', fontStyle: 'bold',
		}).setScale(0.5);
		this.add(this.chainsTimer);

		this.lanceTimer = scene.add.text(213, 88, '', {
			align: 'center', fixedWidth: 56, fontSize: '24px', fontStyle: 'bold',
		}).setScale(0.5);
		this.add(this.lanceTimer);

		this.lanceStacks = scene.add.text(229, 71, '', {
			color: '#ffffff', fontSize: '20px', stroke: '#000000', strokeThickness: 5,
		}).setScale(0.66);
		this.add(this.lanceStacks);

		this.target = null;
		this.visible = false;
	}

	setTarget(newTarget) {
		this.target = newTarget;
		if (newTarget != null) {
			this.targetName.setText(newTarget.ghostName);
			this.visible = true;
		} else {
			this.visible = false;
		}
	}

	update() {
		if (this.target == null) return;
		if (!this.target.alive) {
			this.setTarget(null);
			return;
		}

		const pct = this.target.currentHP / this.target.maxHP;
		this.hpPercentage.setText(Math.ceil(pct * 100) + '%');
		this.hpForeground.scaleX = pct;
		this.hpForeground.fillColor = this.healthColor(138, 0, 0, pct);
		this.hpBackground.fillColor = this.healthColor(144, 111, 102, pct);

		this.lanceStacks.visible = this.target.lanceStacks > 1;
		this.lanceStacks.setText(String(this.target.lanceStacks));

		const lanceMs = this.target.lanceTimeRemaining();
		this.lanceTimer.setText(String(Math.ceil(lanceMs / 1000)));
		this.lanceTimer.visible = lanceMs > 0;
		this.lanceIcon.visible = lanceMs > 0;

		const chainsMs = this.target.frozenTimeRemaining();
		this.chainsTimer.setText(String(Math.ceil(chainsMs / 1000)));
		this.chainsTimer.visible = this.target.frozen && chainsMs > 0;
		this.chainsIcon.visible = this.target.frozen && chainsMs > 0;
	}

	// Green -> red gradient as HP drops (ported from the original).
	healthColor(greenMax, redMin, blueValue, pct) {
		let green = greenMax;
		if (pct <= 0.5) {
			green = blueValue + Math.ceil((greenMax - blueValue) * pct * 2);
		}
		let red = redMin + Math.ceil((greenMax - redMin) * ((1.0 - pct) * 2));
		if (pct <= 0.5) red = greenMax;
		return (red << 16) + (green << 8) + blueValue;
	}
}
