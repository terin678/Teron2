// Distance-aware tab targeting. Pure JS — units only need {x, y}.
//
// Behavior (WoW-like): when a cycle starts, living targets are sorted by
// distance from the player, nearest first. Repeated presses walk outward
// through that fixed order (no mid-cycle re-sorting, so it never ping-pongs),
// then the order is rebuilt on wrap-around or when membership changes.

export function distSq(a, b) {
	const dx = a.x - b.x, dy = a.y - b.y;
	return dx * dx + dy * dy;
}

export function sortByDistance(units, from) {
	return [...units].sort((a, b) => distSq(a, from) - distSq(b, from));
}

export function nearest(units, from) {
	if (!units.length) return null;
	return sortByDistance(units, from)[0];
}

export class TabCycler {
	constructor() {
		this.order = [];
	}

	reset() {
		this.order = [];
	}

	_isStale(alive, current) {
		if (current == null) return true;
		if (!this.order.includes(current)) return true;
		if (this.order.length !== alive.length) return true;
		return !alive.every(u => this.order.includes(u));
	}

	next(alive, from, current) {
		if (!alive.length) return null;
		if (this._isStale(alive, current)) {
			this.order = sortByDistance(alive, from);
			// If the nearest is already selected, step to the second one.
			if (this.order[0] === current && this.order.length > 1) return this.order[1];
			return this.order[0];
		}
		const i = this.order.indexOf(current);
		if (i === this.order.length - 1) {
			// Wrapping: rebuild so the new cycle reflects current positions.
			this.order = sortByDistance(alive, from);
			return this.order[0];
		}
		return this.order[i + 1];
	}

	prev(alive, from, current) {
		if (!alive.length) return null;
		if (this._isStale(alive, current)) {
			this.order = sortByDistance(alive, from);
			return this.order[this.order.length - 1]; // walk inward from the farthest
		}
		const i = this.order.indexOf(current);
		if (i === 0) {
			this.order = sortByDistance(alive, from);
			return this.order[this.order.length - 1];
		}
		return this.order[i - 1];
	}
}
