param()
$ErrorActionPreference = 'Stop'
$checks = @(
    'scene-regression.js', 'performance-features.js', 'project-regression.js',
    'render-modes.js', 'atari-video-music.js', 'video-music-2.js',
    'nethack-visualizer.js', 'pixelmusic-3000.js', 'display-controls.js',
    'ui-regression.js', 'audio-controls.js', 'audio-setup.js',
    'history-recovery.js', 'preset-gallery.js', 'preset-switching.js', 'security-hardening.js',
    'live-transport.js', 'live-background.js', 'live-rendering.js', 'live-audio.js'
)
$runner = Join-Path $PSScriptRoot 'scene-regression.ps1'
foreach ($check in $checks) {
    & $runner -TestScript $check
}
Write-Output "All $($checks.Count) isolated Chrome suites passed."
