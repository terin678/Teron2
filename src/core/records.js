// Best kill times per difficulty, persisted to localStorage. Pure JS.

const STORAGE_KEY = 'teron2.records';
const MAX_KEPT = 5;

// Modes: 'normal' / 'practice' (2D) and 'normal3d' / 'practice3d' (3D).
export function loadRecords() {
	const records = { normal: [], practice: [] };
	try {
		const r = JSON.parse(localStorage.getItem(STORAGE_KEY));
		if (r && typeof r === 'object') {
			for (const [mode, list] of Object.entries(r)) {
				if (Array.isArray(list)) records[mode] = list.filter(Number.isFinite);
			}
		}
	} catch (e) { /* fall through */ }
	return records;
}

// Records a win time (seconds). Returns { best, isRecord } where isRecord means
// this time is the new personal best for that difficulty.
export function addRecord(difficulty, seconds) {
	const records = loadRecords();
	const list = records[difficulty] ?? (records[difficulty] = []);
	const previousBest = list.length ? Math.min(...list) : null;
	list.push(seconds);
	list.sort((a, b) => a - b);
	records[difficulty] = list.slice(0, MAX_KEPT);
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
	} catch (e) { /* non-persistent, fine */ }
	return {
		best: Math.min(seconds, previousBest ?? seconds),
		isRecord: previousBest === null || seconds < previousBest,
	};
}

export function formatTime(seconds) {
	return seconds.toFixed(2) + 's';
}
