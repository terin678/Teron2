# Parity checklist vs. the original

A line-by-line audit of this remake against Faldorn's original
([jconnop/teron](https://github.com/jconnop/teron), live at
[teron.faldorn.net](https://teron.faldorn.net/terongame/)), built by reading the original's
full source rather than by playing it.

Legend: **=** faithful · **+** deliberate improvement · **~** differs, accepted · **!** open gap

Last audited 2026-08-26.

---

## Flow

| | Item | 2D | 3D |
|---|---|---|---|
| = | Preload screen with progress bar and percentage | ✓ | n/a |
| + | Story text ("It's just another day in Black Temple...") | ✓ on the Menu, not a separate Intro scene | ~ short blurb instead |
| = | Prep timer: 13s first attempt, 10s on retries | ✓ | ✓ |
| + | Tutorial and Practice modes | ✓ | Practice only |

## Player

| | Item | Status |
|---|---|---|
| = | Movement speed 90 px/s (7 yards/sec) | ✓ both |
| = | Click-and-hold to move; desktop follows the live pointer, mobile moves to a snapshot | ✓ both |
| = | Keyboard input cancels click-to-move | ✓ both |
| = | Player becomes a ghost (sprite frame 2 + tint) when constructs spawn | ✓ both |
| = | Collides with arena walls and world bounds | ✓ both |

## Constructs

| | Item | Status |
|---|---|---|
| = | Four, named "Deadly Construct 1".."4" | ✓ both |
| = | 65,000 HP each | ✓ both |
| = | Speed 45 px/s | ✓ both |
| = | Spawn ±20px around the player, 1s grace before moving | ✓ both |
| = | Pathing: corridor (x 240–360 or y ≤ 270) → boss (300,150), else doorway (300,310) | ✓ both |
| = | Lose when any construct comes within 20px of the boss | ✓ both |
| = | Death fades out over 300ms | ✓ both |
| = | Blue tint while slowed, cleared when the slow expires | ✓ both |
| = | Diamond freeze indicator on frozen constructs | ✓ both |

## Abilities

| | Item | Status |
|---|---|---|
| = | Spirit Strike — melee 6yd, 638–862 | ✓ both |
| = | Spirit Lance — 30yd, 6175–6825, 30%/stack slow (max 3, 9s) | ✓ both |
| = | Spirit Chains — 12yd AoE, 1900–2100, 5s freeze, 15s CD | ✓ both |
| = | Spirit Volley — 12yd AoE, 9900–12100, 15s CD | ✓ both |
| = | Spirit Shield — flavour only, triggers GCD | ✓ both |
| = | 1s shared GCD | ✓ both |
| = | Damage is the average of the range, applied after projectile travel | ✓ both |
| = | **Any damage breaks the freeze** (so Volley after Chains wastes it) | ✓ both |
| = | Icons tint grey on GCD/cooldown; countdown numbers on Chains and Volley | ✓ both |
| = | Spell frame lit while the key is held or the icon is moused-down | ✓ | ~ 3D has no moused-down state |
| = | Cast ability name announced as text | ✓ both |
| = | Clicking a spell icon casts it | ✓ both |
| = | Nova effect for Chains, projectile effect for Lance/Volley | ✓ particles | ~ 3D uses meshes, not particles |
| + | "Out of range" / "No target" / "Not ready yet" feedback (original failed silently) | ✓ both |
| + | Spell queue: a press during the 1s GCD fires when it clears, as WoW does. The original dropped it silently, which reads as the button not working | ✓ both |

## Targeting

| | Item | Status |
|---|---|---|
| + | **Tab targets the nearest and cycles outward; Shift-Tab the furthest** — the original cycled in fixed spawn-array order, which is what made it feel random | ✓ both |
| + | Dedicated "target nearest" key | ✓ both |
| + | Enlarged click hitboxes | ✓ both |
| + | Right-click also targets, and no browser context menu | ✓ both |
| = | Red target highlight ring | ✓ both |
| = | Target frame: name, HP bar with green→red gradient, HP%, lance stacks and timer, chains timer | ✓ both |
| + | Mouseover casting, **off by default**, with a gold ring showing the hovered construct | ✓ both |

## Audio

| | Item | Status |
|---|---|---|
| = | teron_Aggro at start (0.3s delay) | ✓ both |
| = | Black Temple music at volume 0.15 | ✓ both |
| = | Random Teron barks: none for 4s, ≤1 check/sec, ~20% chance, never twice in a row, never overlapping | ✓ both |
| = | teron_Death on win (1.3s delay), teron_Enrage on lose (0.75s delay) | ✓ both |
| = | ghost_Spawn on spawn, ghost_Death per construct | ✓ both |
| = | Per-spell cast and impact sounds | ✓ both |
| = | Mute toggle | ✓ both |
| + | 3D defers music/ambience (~2.5MB) until a run starts | n/a | ✓ |

## Cheats

| | Item | Status |
|---|---|---|
| = | `iddqd` disables losing, plays the horseman laugh | ✓ both |
| = | `idkfa` removes cooldowns, plays the orc kid laugh | ✓ both |
| = | Cheated wins show a greyed `You "won" in X...` plus **BUT YOU CHEATED!** | ✓ both |

## Win / lose screens

| | Item | Status |
|---|---|---|
| = | Win: "All constructs defeated! / Your raid members cheer at you! / You saved their day!" | ✓ both |
| = | Win time line: "You won in X seconds! Can you beat your friends?" | ✓ both |
| = | **WoW-parse colour grading**: gold ≤28s, pink ≤29, orange ≤30, purple ≤32, blue ≤35, green ≤40, else grey | ✓ both |
| = | Lose: "Your raid leader audibly sighs... / Ok wipe it up..." | ✓ both |
| = | Overlays fade in over 800ms | ✓ both |
| ~ | "Join Valhalla" button — intentionally omitted, it links to the original author's guild | — |
| + | Personal best and NEW RECORD, tracked per mode | ✓ both |

## Mobile

| | Item | Status |
|---|---|---|
| = | Ability bar scaled 1.4 and repositioned; constructs, indicators and highlights scaled 2×; player 1.5×; spawn offset ×1.6; construct-vs-construct colliders | ✓ | |
| ! | **3D mode has no touch support** — pointer events mean taps incidentally work, but there is no HUD scaling, no on-screen movement control, and pinch-zoom is missing (zoom is wheel-only) | n/a | ✗ |

## Deliberately not carried over

- **Google Analytics** — the original reports events via gtag; this build makes no external calls.
- **QWERTY/AZERTY toggle** — superseded by fully rebindable keys, which covers both and more.
- **"Join Valhalla" link** — belongs to the original author's guild.

## Known open gaps

1. **3D touch/mobile support** — see the mobile row above.
2. **3D has no Tutorial mode** — 2D only.
3. **Freeze-break and damage rules aren't unit-tested** — they live inside the Phaser and Three
   layers, which need their engines to import. Verified by playing instead. Fixing this properly is
   the deterministic-sim refactor tracked in [IDEAS.md](IDEAS.md).
