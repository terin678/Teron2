# Teron2 — Ideas Backlog

Parked ideas and the research behind them, so picking one up later doesn't mean redoing the work.

Each entry states its status, why it's parked, what's already settled, and — importantly — which
findings are **verified** versus **unverified assumptions** that must be re-checked before building.

---

## 1. Global leaderboard backed by Warcraft Logs

**Status:** parked (researched 2026-08-26, nothing built)

**The idea:** a player pastes a WCL guild page or ID — e.g. `https://fresh.warcraftlogs.com/guild/id/782456`
— picks their character out of the guild roster, and their kill times appear on a global board.

**Why it's parked:** the character-identity question (section 3) stalled it. Everything else was
decided; identity wasn't, and it's load-bearing for the whole design.

### Decisions already made

| Question | Decision |
|---|---|
| Backend hosting | Node server on the **existing `teron2` Fly app**, replacing nginx and serving both the static game and the API. Scores in **SQLite on a small Fly volume**. |
| Anti-cheat | **Full replay verification** (see section 2) — not honor-system. |
| Boards | **2D Normal and 3D Normal as separate boards.** Practice and Tutorial never submit. |
| Character identity | **Undecided — deliberately deferred.** See section 3. |

### Research findings

**Scraping is not an option.** `fresh.warcraftlogs.com` sits behind a Cloudflare "confirm you are
human" interstitial — the HTML pages can't be fetched programmatically. The official API is the
only viable path. (This is a good thing: it forces the correct design.)

**Fresh is a first-class API site profile**, alongside retail (`www.warcraftlogs.com`) and
`classic.warcraftlogs.com`. All three expose the same GraphQL schema surface and OAuth docs.

- Public GraphQL (Fresh): `https://fresh.warcraftlogs.com/api/v2/client`
- Public GraphQL (retail, for reference): `https://www.warcraftlogs.com/api/v2/client`
- Token URI: `https://www.warcraftlogs.com/oauth/token`

**Auth — OAuth2 client credentials flow.** POST `grant_type=client_credentials` to the token URI
with HTTP basic auth using `client_id` as user and `client_secret` as password, then send
`Authorization: Bearer <access_token>` on GraphQL requests:

```
curl -u {client_id}:{client_secret} -d grant_type=client_credentials \
  https://www.warcraftlogs.com/oauth/token
```

Client credentials reach public data only (no private reports), which is all a roster needs. **The
client secret must never reach the browser** — this is the main reason the feature requires a
backend at all. On Fly: `flyctl secrets set WCL_CLIENT_ID=… WCL_CLIENT_SECRET=…`.

> ⚠️ **Unverified:** whether the Fresh host needs a token minted from its *own* `/oauth/token` or
> shares the `www` one. All three hosts publish identical OAuth docs, which suggests shared, but
> this was never tested against a live credential. **Make both the token host and the API host
> env-configurable** and confirm empirically before hardcoding either.

**Roster query.** `guildData` → `guild(id:)` exposes a `members(...)` field. There is also
`characterData.characters(guildID:, limit:, page:)` returning a `CharacterPagination`.

> ⚠️ **Unverified:** the exact field name, arguments and return shape. Introspect the live schema
> (or browse `https://fresh.warcraftlogs.com/v2-api-docs/warcraft/guild.doc.html`) before writing
> the query rather than trusting the above.

**Rate limit: 3,600 points per hour, per client.** Monitor it by appending to any query:

```graphql
rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }
```

Implication: **cache guild rosters server-side** (a 24h TTL is plenty) instead of calling WCL on
every page load. Rosters change slowly and many players share a guild.

**Guild URL parsing.** `https://fresh.warcraftlogs.com/guild/id/<id>` → take the trailing integer.
Accept a bare numeric ID too, since that's what people will paste half the time.

### Notes for whoever builds this

`fly.toml` currently has `min_machines_running = 0` with `auto_stop_machines = "stop"`, so the
machine scales to zero when idle. That's fine for static hosting but matters for a stateful API:
SQLite on a volume survives stop/start, but the machine must be pinned to the volume's region, and
there's a cold start on the first request. There is no `[[mounts]]` block and no `[env]` today.

`nginx.conf` is static-only (no `proxy_pass`, no `/api` location) and the `Dockerfile` is a bare
`nginx:alpine` that `COPY`s named paths. Both get replaced by the Node server under this plan.

**Sources:** [WCL API docs](https://www.warcraftlogs.com/api/docs) ·
[Guild schema](https://www.warcraftlogs.com/v2-api-docs/warcraft/guild.doc.html) ·
[RateLimitData schema](https://sod.warcraftlogs.com/v2-api-docs/warcraft/ratelimitdata.doc.html) ·
[warcraft_cli endpoint/site-profile notes](https://github.com/aurokin/warcraft_cli/blob/main/docs/warcraftlogs/README.md)

---

## 2. Replay verification (deterministic sim refactor)

**Status:** parked — designed, not built. Chosen as the anti-cheat approach for the leaderboard,
but valuable on its own.

**The problem:** run times are computed client-side and posted from a browser. `window.game` and
`window.g3d` are exposed, so any score is trivially forgeable. An honor-system global board would
be meaningless within a day.

**The design:** the client records an input trace — timestamped actions, click-to-move coordinates,
and the difficulty — and submits it alongside the run. The server re-runs the same `src/core/` sim
at a fixed timestep and confirms the resulting duration matches the claim.

### Why this is actually achievable

The simulation is already almost entirely deterministic:

- **Damage is not random.** `applyDamage` uses the *average* of the min/max range, never a roll
  (`Ghost.applyDamage`, `AbilityBar.applyDelayed`, and the 3D `applyImpact`).
- **`Math.random()` appears only in `playRandomBark()`** — cosmetic Teron voice lines with zero
  gameplay effect.
- Cooldowns, GCD, freeze/slow durations, ability ranges and ghost pathing are all pure functions of
  elapsed time and player input.

### The blocker

The **2D game rides Phaser Arcade physics** — `physics.moveToObject`, `setVelocity`, and wall
colliders — which steps internally and is frame-rate dependent, so it can't be replayed exactly.

The **3D mode already hand-rolls a deterministic sim** (`tryMove`, `updateGhost`, and an accumulated
`simTime` rather than wall-clock).

To verify both front-ends, 2D movement and wall collision must be extracted onto the shared core
sim. That's a real refactor, but it collapses the two front-ends onto a single source of truth —
worth doing regardless of whether the leaderboard ever ships.

### Integration points

- **Choke point:** `addRecord(difficulty, seconds)` in `src/core/records.js` is called exactly once
  per qualifying win from each front-end — the natural place to hang a submission.
- Mode keys in play: `normal`, `practice` (2D) and `normal3d`, `practice3d` (3D).
- Cheat runs (`iddqd` / `idkfa`) and Tutorial (`noRecords`) already bypass `addRecord` in 2D. **The
  3D `winGame()` has no `noRecords` branch** — check that before wiring submissions.
- Timing sources differ between front-ends today: 2D uses `this.time.now - this.ghostSpawnAt`,
  3D uses accumulated `this.simTime`. Unify these as part of the refactor.

### Cheap guard worth keeping even with replay

A mechanical floor on submitted times. Working it out:

- 4 ghosts × 65,000 HP = **260,000 total**
- Within their 15s cooldowns you land 2 Spirit Volleys (11,000 each) and 2 Spirit Chains (2,000
  each) → **26,000 per ghost from AoE**
- Remaining 39,000 per ghost ÷ 6,500 per Spirit Lance = **6 Lances each = 24 Lance GCDs**
- Total ≈ 2 + 2 + 24 = **~28 one-second GCDs → roughly a 28 second floor**

> ⚠️ **Unverified:** this ignores projectile travel time and the 1s spawn grace, and assumes every
> ghost stays in range the whole fight. Re-derive and pad it before using it as a server-side
> rejection threshold — but *some* floor cheaply kills the "0.5s" submissions.

---

## 3. Character identity — the open question

**Status:** unresolved. This is the specific question that parked the leaderboard.

Picking a character from a guild roster proves the character *exists*; it does not prove it's
**yours**. Nothing stops someone submitting as their guild's top raider.

| Approach | How it works | Tradeoff |
|---|---|---|
| **Honor-system roster pick** | Paste guild → pick character. What was originally asked for. | Zero friction, names are real. Ownership entirely unproven. |
| **Roster pick + optional WCL login** | Same flow, but players *may* log in via OAuth authorization-code (`userData { currentUser }`) to earn a ✓ verified marker. Unverified entries still allowed. | Best of both, but needs a user-OAuth app and a registered redirect URI. |
| **Require WCL login** | No submission without logging in and claiming the character. | Strongest identity, real friction — many players never claim characters on their WCL account and would be locked out entirely. |

Worth noting the middle option pairs naturally with replay verification: a run could carry two
independent badges — *time verified* (replay) and *identity verified* (WCL login).

---

## 4. Hosting / scaling — migrated to GitHub Pages 2026-08-26

**Status:** DONE. Live at https://terin678.github.io/Teron2/, deployed by CI from
`terin678/Teron2`. Fly (`teron2.fly.dev`) is still up and is the rollback.

**Still open:** decide the Fly app's fate — keep it stopped as the future leaderboard backend
(section 1 needs a real server either way), or destroy it. Keep it until Pages has had some real
traffic.

**What the original does:** `teron.faldorn.net` is **GitHub Pages** (`Server: GitHub.com`, CNAME to
`jconnop.github.io`) fronted by **Fastly** (`Via: 1.1 varnish`, `X-Cache: HIT`). Cloudflare handles
DNS for `faldorn.net` but is *not* proxying it. No servers, no scaling knobs, no bandwidth bill.
They set only `max-age=600` on everything and let the CDN edge do the work.

**What we have:** one `shared-cpu-1x` / 256 MB machine in `dfw`, scale-to-zero
(`min_machines_running = 0`, `auto_stop_machines = "stop"`).

**The key constraint, if this ever matters:** Fly does not autoscale.
> "Fly Proxy autostop/autostart never creates or destroys Machines for you."

Autostart only wakes *existing* stopped machines, so at `count = 1` there is no load balancing and
no redundancy. Cross-region routing only kicks in "when all Machines in the local region are
unhealthy or at their `hard_limit`", and there is only one region.

**Levers to pull when traffic arrives** (all deliberately NOT applied, since they add cost):
- `fly scale count 2+` — the actual fix for both redundancy and load balancing.
- Add `[http_service.concurrency]` — the default is `connections` with a soft limit of **20**, far
  too low for static nginx. Something like 250 soft / 500 hard fits this workload.
- `min_machines_running = 1` to eliminate cold starts, at the cost of one always-on machine.
- Spread regions if the audience turns out to be non-US.

**Already applied (free):** long cache headers — `assets/` for a year immutable, `lib/` for 30 days
(deliberately not a year, since the filenames aren't version-stamped and an engine upgrade needs
cached clients to pick it up), everything else 5 minutes.

**Per-visitor payload:** ~4.2 MB for 2D, ~5.1 MB for 3D on a cold cache. Bandwidth, not CPU, is the
thing that would actually cost money at scale.

### The migration, as executed

**Status:** completed 2026-08-26. Notes below kept for the record.

**Two things worth remembering if this is ever redone:**

1. **Private repos meter GitHub Actions minutes; public repos get them free and unlimited.** The
   first attempt used a private repo and CI failed instantly with *"The job was not started because
   recent account payments have failed or your spending limit needs to be increased."* Going public
   unblocked it with no billing change. A paid plan alone is not enough — Actions still bills
   against private-repo minutes.
2. **Pages from a private repo publishes a PUBLIC site anyway** (the API literally returns
   `"public": true`). Private repo only hides the source; only Enterprise Cloud gates the site
   itself. So "keep it private" never protected the assets from being served — only from being
   browsable as a repo.

**Precedent confirmed, not assumed:** `jconnop/teron` is a public, MIT-licensed repo containing all
the same Blizzard assets — 12 PNG, 6 JPG, 22 MP3, 21 OGG, byte-identical to ours (`background.png`
= 685,024 bytes, `blackTempleMusic.mp3` = 1,503,197 bytes). A LICENSE reproducing Jesse Connop's
MIT notice was added, since our mechanics and tuning are ported from that source.

**Why Pages:** free, global Fastly CDN, no machines or scaling knobs, and it's exactly what the
original does. Removes the scaling question entirely rather than tuning it.

**Good news — no code changes needed.** Every asset path in the project is relative
(`lib/phaser.min.js`, `assets/...`, `src/...`, `3d.html`, `index.html`), so the game works
unmodified from a project subpath like `https://terin678.github.io/Teron2/`. Verify this holds
before shipping — an absolute `/assets/...` creeping in anywhere would break it.

**Steps:**
1. `git init` + a `.gitignore` (`node_modules/`, OS cruft). The project is not a git repo yet.
2. Add an empty `.nojekyll` at the repo root so Pages skips Jekyll processing.
3. Add a GitHub Actions workflow that runs `npm test` and then publishes the static files
   (`index.html`, `3d.html`, `lib/`, `assets/`, `src/`) as the Pages artifact. Preferred over
   "serve from branch root" because it (a) gates deploys on the test suite, (b) ships only what the
   game needs, and (c) sidesteps the soft 10-builds/hour limit.
4. `gh repo create terin678/Teron2 --public --source=. --push` — `gh` is already authenticated
   locally as `terin678`.
5. Enable Pages with source = GitHub Actions.
6. Verify both `/` and `/3d.html` load, audio plays, and localStorage keys still work on the new
   origin. **Note:** a new origin means a fresh localStorage — saved keybinds, options and best
   times do NOT carry over from `teron2.fly.dev`. Worth a heads-up to anyone already playing.
7. Only then decide the Fly app's fate (keep stopped for the future leaderboard backend, or
   destroy). Keep it running until Pages is confirmed good — it's the rollback.

**Tradeoffs to accept, eyes open:**
- **Free Pages requires a PUBLIC repo**, which means publishing the Blizzard art and audio. The
  original does exactly this (`jconnop.github.io`), so there's direct precedent, but it's a call to
  make deliberately. Alternative: keep assets out of git and have the workflow fetch them — but
  `tools/download-assets.ps1` is PowerShell and Actions runners are Linux, so that needs a bash
  equivalent first. Extra moving parts for a fan project.
- **The cache tuning does not carry over.** Pages serves everything at `max-age=600` and is not
  configurable, so the 1-year immutable headers on `assets/` are lost. Fastly's edge cache absorbs
  most of it, which is why the original gets away with the same setting — but repeat visitors will
  revalidate more than they do today.
- Soft limits: 100 GB/month bandwidth (~24k fresh visitors at ~4.2 MB each) and a 1 GB site cap
  (we're 7.2 MB). Pages is also documented as not for commercial use — fine for a free fan game.
- The URL changes unless a custom domain is attached.

**Alternative if the public repo is a blocker:** Cloudflare Pages has no bandwidth cap, no
commercial-use restriction, and serves from a private repo — but connecting it requires dashboard
clicks that can't be automated, so it's a create-and-push then hand-off.

---

## 5. Hazard: listeners and sounds outlive a scene restart

**Status:** three instances found and fixed 2026-08-27. Documented because the pattern will
recur — nothing in the type system or the test suite catches it.

**The trap:** Phaser reuses the scene *instance* and its event emitter across `scene.restart()` /
`scene.start()`. Anything registered in `create()` is therefore still attached the next time
`create()` runs, and fires twice. The same is true of the game-level managers (`game.events`,
`game.sound`), which outlive scenes entirely.

**How it showed up:** a tutorial gate appeared stuck — the player pressed the ability, its cooldown
visibly started, but the on-screen step never advanced. A stale handler from a previous run was
firing alongside the live one and rewriting the current step's text.

**Found by counting listeners across repeated cycles** (menu → game → menu, and
pause → options → resume), which is the only reliable way to see it:

| Emitter | Before | After |
|---|---|---|
| `TeronGame` → `ability-cast` | 1, 2, 3 … | 1 |
| `Menu` → `options-closed` | 1, 2, 3, 4 … | 1 |
| `Pause` → `options-closed` | 1, 2, 3 … | 1 |
| `game.sound` → `teron_Intro` instances | 5, 6, 7, 8, 9 … | 1 |

**The rules this codebase follows now:**
- Clear our *own* custom scene events at the top of `create()` (`this.events.off('name')`).
  Never blanket-clear Phaser's lifecycle events — plugins listen on those.
- Wire scene lifecycle handlers (`RESUME`, `SHUTDOWN`) exactly once, behind a flag.
- For `game.events`, keep the handler reference and `off` before `on`.
- For `game.sound`, `removeByKey` before `add`, since sounds belong to the game, not the scene.
- GameObject listeners (`icon.on('pointerdown')`) are safe — they die with the object.

**Worth building:** a browser-level smoke test that runs these cycles and asserts the counters stay
flat. The Node suite can't reach this because it needs a live Phaser scene. Related to the
deterministic-sim refactor in section 2, which would make more of this testable.

---

## 6. Other ideas from the build

- **Mobile/touch support for 3D mode.** The 2D game already reconfigures for mobile (bigger bar,
  scaled ghosts, tap-to-move, ghost-ghost colliders). 3D has no touch controls at all.
- **Richer 3D presentation.** Ghosts are billboard sprites of the original 2D art and Teron is a
  cone. Real models would lift it a lot.
- **"Approach optimal" goal.** Surface the ~28s theoretical floor from section 2 in-game as a
  target to chase, not just a cheat threshold.
- **Tutorial run-away threshold.** Currently releases at 330px from the boss (roughly mid-map) in
  `TeronGame.js`. Revisit whether it should demand reaching the far wall — mid-map is already a
  comfortable spawn distance, but the lesson might land harder if it asked for more.
- **Leaderboard variants** (deferred with section 1): per-guild filtering so guilds can race each
  other internally, and a rolling monthly board beside all-time so newcomers can still top something.
