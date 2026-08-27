# Teron2

An improved remake of the [Teron Gorefiend "Shadow of Death" trainer](https://teron.faldorn.net/terongame/)
by Faldorn — the WoW TBC Black Temple minigame where you die, become a ghost, and must
destroy 4 Deadly Constructs before any of them reaches Teron.

Built with Phaser 3 (2D) and Three.js (3D mode), no build step — plain ES modules.

## Play it

|  | 2D | 3D |
|---|---|---|
| **GitHub Pages** (primary) | [play](https://terin678.github.io/Teron2/) | [play](https://terin678.github.io/Teron2/3d.html) |
| **Fly.io** (mirror) | [play](https://teron2.fly.dev/) | [play](https://teron2.fly.dev/3d.html) |

Both run the same build. GitHub Pages deploys automatically on every push to `main`
once the test suite passes; the Fly mirror is deployed manually with
`flyctl deploy --remote-only`, so after a push it can lag until that runs.

## Run it

Serve the folder with any static file server and open it in a browser:

```
npx http-server -p 8619 -c-1 .
```

Then open http://localhost:8619

Assets are downloaded from the original site by `tools/download-assets.ps1`
(run it once if the `assets/` folder is missing).

## Tests

```bash
npm test
```

Zero dependencies — just Node 20+'s built-in test runner over the pure logic in
`src/core/`. The suite exists to keep the fight faithful to the real encounter:

- **`tests/rotation.test.js`** — locks the ability coach to the published rotation
  (Spirit Volley off cooldown → Spirit Chains off cooldown → Spirit Lance as filler),
  and asserts Strike and Shield never appear during the construct phase.
- **`tests/tutorial.test.js`** — locks the tutorial to teaching that same order.
  The step order lives as data in `src/core/tutorial.js` so it can be asserted on.
- **`tests/abilities.test.js`** — pins damage ranges, ranges, cooldowns, construct HP
  and debuff durations to the original game's values.
- **`tests/targeting.test.js`** — Tab takes the nearest and walks outward, Shift-Tab
  takes the furthest and walks inward.

Rotation source: [Wowhead's Teron Gorefiend mechanic guide](https://www.wowhead.com/tbc/news/practice-teron-gorefiends-mechanics-with-this-flash-game-the-burning-crusade-382614).
Order matters beyond the guide too: Volley is AoE, so casting it *after* a Chains breaks
the freeze on the whole pack — any damage removes the freeze, exactly as in the original.

## What's improved over the original

- **Fully customizable keybinds** — every action (movement, all 5 abilities, targeting,
  pause) is rebindable in Options, including mouse buttons 4/5. Two slots per action.
  Persisted in localStorage.
- **Smart tab targeting** — Tab targets the *closest* construct and cycles outward;
  Shift-Tab targets the *furthest* and cycles inward. A dedicated Target Nearest key (F).
  Enlarged click hitboxes; right-click also targets.
- **Right-click fixed** — no more browser context menu popping up mid-fight, and
  mouse back/forward buttons don't navigate away.
- **Pause** — Esc pauses (game, cooldowns, sounds all freeze); auto-pauses when the
  window loses focus.
- **Mouseover casting** — Strike/Lance hit the construct under your cursor without
  changing your selected target (toggleable).
- **Auto-target nearest** — casting with no target picks the closest construct (toggleable).
- **Tutorial mode** — step-by-step muscle-memory trainer: it teaches you to run away
  from Teron first (the timer waits for you), then freezes the constructs and walks you
  through each ability, waiting for the correct keypress.
- **Practice mode** — 60% ghost speed, longer prep timer, on-screen hints.
- **Objective surfaced** — pulsing ring on Teron plus an objective banner so first-timers
  know what the constructs are heading for.
- **Best-time tracking** — personal bests per mode (Normal / Practice), stored locally.
- **3D mode** (`3d.html`) — the same fight rendered in Three.js: perspective chase camera
  over the original arena art, billboard ghost sprites, projectile/nova effects, wheel zoom.
  Full mechanics parity (GCD, cooldowns, slow/freeze, pathing, cheats), Normal + Practice,
  separate best times. Keybinds/options are shared with the 2D game via localStorage.

The original mechanics (damage ranges, cooldowns, GCD, slow/freeze behavior, ghost
pathing, cheat codes) are preserved exactly. Shared game data/logic lives in
`src/core/` (no renderer dependencies); the Phaser front-end is `src/game/`, the
Three.js front-end is `src/three/`.

## Deploy

Deployed on Fly.io as app `teron2` (nginx serving the static files, single
shared-cpu machine with autostop):

```
flyctl deploy --remote-only --config fly.toml
```

## Credits

- Original game and assets: Faldorn — teron.faldorn.net ([buy them a coffee](https://www.buymeacoffee.com/faldorn))
- Graphics and sounds are property of Blizzard Entertainment.
