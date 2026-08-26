import {
	ACTION_DEFS, DEFAULT_SETTINGS, saveSettings, eventSig, bindLabel, assignBind, bareCode,
} from '../../core/settings.js';

const ROW_H = 34;
const SLOT_W = 110;

export class Options extends Phaser.Scene {

	constructor() {
		super('Options');
	}

	create(data) {
		this.scene.bringToTop();
		this.from = data?.from ?? 'Menu';
		this.settings = this.registry.get('settings');
		this.capturing = null; // { action, slot }
		this.slotTexts = {};   // action -> [text, text]

		// Full-screen input blocker + dim
		const blocker = this.add.rectangle(300, 400, 600, 800, 0x000000, 0.88);
		blocker.setInteractive();

		this.add.text(300, 46, 'Options', { fontSize: '36px', fontStyle: 'bold' }).setOrigin(0.5, 0.5);

		// Toggles
		this.toggleStates = {};
		this.makeToggle(90, 'mouseoverCast', 'Mouseover casting (cursor overrides your target)');
		this.makeToggle(122, 'autoTargetNearest', 'Auto-target nearest when casting with no target');
		this.makeToggle(154, 'abilityCoach', 'Ability coach (glow on the next recommended ability)');

		// Keybind grid
		this.add.text(60, 184, 'Keybinds — click a slot, then press a key (or mouse button 4/5).\nRight-click a slot to clear it.', {
			color: '#9fd3ff', fontSize: '13px',
		});
		let y = 222;
		let lastGroup = null;
		for (const def of ACTION_DEFS) {
			if (lastGroup !== null && def.group !== lastGroup) y += 10;
			lastGroup = def.group;
			this.makeBindRow(y, def);
			y += ROW_H;
		}

		this.notice = this.add.text(300, y + 12, '', {
			color: '#f6d21f', fontSize: '15px',
		}).setOrigin(0.5, 0);

		// Buttons
		this.makeTextButton(190, 756, 'Reset to defaults', () => this.resetDefaults());
		this.makeTextButton(430, 756, 'Back', () => this.close());

		// Capture input
		this.input.keyboard.on('keydown', this.onKeyDown, this);
		this.input.on('pointerdown', this.onPointerDown, this);
	}

	makeToggle(y, key, label) {
		const box = this.add.rectangle(72, y, 20, 20, 0x222222).setStrokeStyle(2, 0x888888);
		box.setInteractive({ useHandCursor: true });
		const check = this.add.image(72, y, 'check').setScale(0.28);
		check.visible = this.settings[key];
		const toggle = () => {
			this.settings[key] = !this.settings[key];
			check.visible = this.settings[key];
			saveSettings(this.settings);
		};
		box.on('pointerdown', toggle);
		const text = this.add.text(92, y - 9, label, { fontSize: '15px' });
		text.setInteractive({ useHandCursor: true });
		text.on('pointerdown', toggle);
	}

	makeBindRow(y, def) {
		this.add.text(60, y, def.label, { fontSize: '16px' });
		this.slotTexts[def.id] = [];
		for (let slot = 0; slot < 2; slot++) {
			const x = 300 + slot * (SLOT_W + 14);
			const rect = this.add.rectangle(x, y + 9, SLOT_W, 26, 0x1c2c3c).setStrokeStyle(1, 0x557799);
			rect.setInteractive({ useHandCursor: true });
			const text = this.add.text(x, y + 9, bindLabel(this.settings.binds[def.id][slot]), {
				fontSize: '15px',
			}).setOrigin(0.5, 0.5);
			this.slotTexts[def.id].push({ text, rect });
			rect.on('pointerdown', pointer => {
				if (pointer.rightButtonDown()) {
					this.settings.binds[def.id][slot] = null;
					saveSettings(this.settings);
					this.refreshLabels();
					return;
				}
				if (pointer.button === 0) this.beginCapture(def, slot);
			});
		}
	}

	makeTextButton(x, y, label, onClick) {
		const text = this.add.text(x, y, label, {
			backgroundColor: '#1c2c3c', fontSize: '18px', padding: { x: 14, y: 8 },
		}).setOrigin(0.5, 0.5);
		text.setInteractive({ useHandCursor: true });
		text.on('pointerover', () => text.setTint(0xf6e91f));
		text.on('pointerout', () => text.clearTint());
		text.on('pointerdown', onClick);
	}

	beginCapture(def, slot) {
		this.endCapture();
		this.capturing = { action: def.id, slot };
		const entry = this.slotTexts[def.id][slot];
		entry.rect.setStrokeStyle(2, 0xf6d21f);
		entry.text.setText('press key...');
		this.notice.setText('Press a key or mouse button 4/5 — Esc cancels');
	}

	endCapture() {
		if (!this.capturing) return;
		const { action, slot } = this.capturing;
		this.slotTexts[action][slot].rect.setStrokeStyle(1, 0x557799);
		this.capturing = null;
		this.refreshLabels();
	}

	onKeyDown(e) {
		if (!this.capturing) {
			if (e.code === 'Escape') this.close();
			return;
		}
		e.preventDefault();
		if (e.code === 'Escape') {
			this.notice.setText('Cancelled');
			this.endCapture();
			return;
		}
		if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' ||
			e.code === 'ControlLeft' || e.code === 'ControlRight' ||
			e.code === 'AltLeft' || e.code === 'AltRight') {
			return; // wait for the real key; shift becomes a modifier
		}
		let sig = eventSig(e);
		// Movement is held-state, matched by bare code — no shift-modified binds there.
		const def = ACTION_DEFS.find(d => d.id === this.capturing.action);
		if (def.group === 'movement') sig = bareCode(sig);
		this.applyCapturedSig(sig);
	}

	onPointerDown(pointer) {
		if (!this.capturing) return;
		if (pointer.button >= 3) {
			pointer.event.preventDefault();
			this.applyCapturedSig('Mouse' + pointer.button);
		}
	}

	applyCapturedSig(sig) {
		const { action, slot } = this.capturing;
		const stolenFrom = assignBind(this.settings.binds, action, slot, sig);
		saveSettings(this.settings);
		if (stolenFrom) {
			const stolenDef = ACTION_DEFS.find(d => d.id === stolenFrom);
			this.notice.setText(bindLabel(sig) + ' was taken from "' + (stolenDef?.label ?? stolenFrom) + '"');
		} else {
			this.notice.setText('');
		}
		this.endCapture();
	}

	refreshLabels() {
		for (const def of ACTION_DEFS) {
			for (let slot = 0; slot < 2; slot++) {
				this.slotTexts[def.id][slot].text.setText(bindLabel(this.settings.binds[def.id][slot]));
			}
		}
	}

	resetDefaults() {
		this.settings.binds = structuredClone(DEFAULT_SETTINGS.binds);
		this.settings.mouseoverCast = DEFAULT_SETTINGS.mouseoverCast;
		this.settings.autoTargetNearest = DEFAULT_SETTINGS.autoTargetNearest;
		saveSettings(this.settings);
		this.scene.restart({ from: this.from });
	}

	close() {
		this.endCapture();
		const from = this.from;
		this.scene.stop();
		// Let the underlying scene refresh bind-dependent UI.
		this.scene.get(from)?.events.emit('options-closed');
	}
}
