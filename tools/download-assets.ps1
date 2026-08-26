# Downloads the original terongame assets from teron.faldorn.net for local use,
# plus a current Phaser 3 build. Safe to re-run; skips files that already exist.
$ErrorActionPreference = 'Stop'
$base = 'https://teron.faldorn.net/terongame'
$root = Split-Path -Parent $PSScriptRoot

$files = @(
    'assets/background.png'
    'assets/sprites/balls.png'
    'assets/animations/blue.png'
    'assets/buttons.png'
    'assets/check.png'
    'assets/coffee.png'
    'assets/ghost_transparent.png'
    'assets/soundOff.png'
    'assets/soundOn.png'
    'assets/spellFrame.png'
    'assets/targetFrame.png'
    'assets/spells/debuff_shadowOfDeath.jpg'
    'assets/spells/spell_spiritChains.jpg'
    'assets/spells/spell_spiritLance.jpg'
    'assets/spells/spell_spiritShield.jpg'
    'assets/spells/spell_spiritStrike.jpg'
    'assets/spells/spell_spiritVolley.jpg'
    'assets/sounds/environment/blackTempleAmbience.ogg'
    'assets/sounds/environment/blackTempleAmbience.mp3'
    'assets/sounds/environment/blackTempleMusic.mp3'
    'assets/sounds/environment/horsemanLaugh.ogg'
    'assets/sounds/environment/horsemanLaugh.mp3'
    'assets/sounds/environment/orcKidLaugh.ogg'
    'assets/sounds/environment/orcKidLaugh.mp3'
    'assets/sounds/ghost/ghost_Death.ogg'
    'assets/sounds/ghost/ghost_Death.mp3'
    'assets/sounds/ghost/ghost_Spawn.ogg'
    'assets/sounds/ghost/ghost_Spawn.mp3'
    'assets/sounds/spells/spiritChains_Cast.ogg'
    'assets/sounds/spells/spiritChains_Cast.mp3'
    'assets/sounds/spells/spiritChains_Impact.ogg'
    'assets/sounds/spells/spiritChains_Impact.mp3'
    'assets/sounds/spells/spiritLance_Cast.ogg'
    'assets/sounds/spells/spiritLance_Cast.mp3'
    'assets/sounds/spells/spiritLance_Impact.ogg'
    'assets/sounds/spells/spiritLance_Impact.mp3'
    'assets/sounds/spells/spiritStrike_Cast.ogg'
    'assets/sounds/spells/spiritStrike_Cast.mp3'
    'assets/sounds/spells/spiritStrike_Impact.ogg'
    'assets/sounds/spells/spiritStrike_Impact.mp3'
    'assets/sounds/spells/spiritVolley_Cast.ogg'
    'assets/sounds/spells/spiritVolley_Cast.mp3'
    'assets/sounds/spells/spiritVolley_Impact.ogg'
    'assets/sounds/spells/spiritVolley_Impact.mp3'
    'assets/sounds/teron/teron_Aggro.ogg'
    'assets/sounds/teron/teron_Aggro.mp3'
    'assets/sounds/teron/teron_Death.ogg'
    'assets/sounds/teron/teron_Death.mp3'
    'assets/sounds/teron/teron_DeathAndDecay.ogg'
    'assets/sounds/teron/teron_DeathAndDecay.mp3'
    'assets/sounds/teron/teron_deathCoil.ogg'
    'assets/sounds/teron/teron_deathCoil.mp3'
    'assets/sounds/teron/teron_Enrage.ogg'
    'assets/sounds/teron/teron_Enrage.mp3'
    'assets/sounds/teron/teron_Intro.ogg'
    'assets/sounds/teron/teron_Intro.mp3'
    'assets/sounds/teron/teron_Special1.ogg'
    'assets/sounds/teron/teron_Special1.mp3'
    'assets/sounds/teron/teron_Special2.ogg'
    'assets/sounds/teron/teron_Special2.mp3'
)

$ok = 0; $skipped = 0; $failed = @()
foreach ($f in $files) {
    $dest = Join-Path $root ($f -replace '/', '\')
    if (Test-Path $dest) { $skipped++; continue }
    $dir = Split-Path -Parent $dest
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
    try {
        Invoke-WebRequest -Uri "$base/$f" -OutFile $dest -UseBasicParsing
        $ok++
    } catch {
        $failed += $f
        Write-Warning "FAILED: $f ($($_.Exception.Message))"
    }
}

# Phaser 3 (current)
$phaserDest = Join-Path $root 'lib\phaser.min.js'
if (-not (Test-Path $phaserDest)) {
    New-Item -ItemType Directory -Force (Join-Path $root 'lib') | Out-Null
    Invoke-WebRequest -Uri 'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js' -OutFile $phaserDest -UseBasicParsing
    Write-Host "Downloaded phaser.min.js"
}

Write-Host "Done. Downloaded: $ok, skipped (existing): $skipped, failed: $($failed.Count)"
if ($failed.Count -gt 0) { $failed | ForEach-Object { Write-Host "  FAILED: $_" } }
