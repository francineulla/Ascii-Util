param([ValidateSet('scene-regression.js', 'performance-features.js', 'atari-video-music.js', 'video-music-2.js', 'project-regression.js', 'render-modes.js', 'nethack-visualizer.js', 'display-controls.js', 'pixelmusic-3000.js', 'ui-regression.js', 'audio-controls.js')][string]$TestScript = 'scene-regression.js')
$ErrorActionPreference = 'Stop'
$repoDir = Split-Path $PSScriptRoot -Parent
$testDir = Join-Path $env:TEMP ('ascii-scene-tests-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $testDir | Out-Null
Copy-Item -LiteralPath (Join-Path $repoDir 'app.js'), (Join-Path $repoDir 'styles.css') -Destination $testDir
Copy-Item -LiteralPath (Join-Path $repoDir 'js') -Destination $testDir -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot $TestScript) -Destination (Join-Path $testDir 'checks.js')
$html = Get-Content -LiteralPath (Join-Path $repoDir 'index.html') -Raw -Encoding UTF8
Set-Content -LiteralPath (Join-Path $testDir 'test.html') -Value $html.Replace('</body>', "<script src='checks.js'></script></body>") -Encoding UTF8
$chromePath = Join-Path ${env:ProgramFiles} 'Google\Chrome\Application\chrome.exe'
$url = 'file:///' + $testDir.Replace('\', '/') + '/test.html'
$profileDir = Join-Path $testDir 'profile'
$previousPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$result = & $chromePath --headless --disable-gpu --dump-dom --virtual-time-budget=10000 "--user-data-dir=$profileDir" $url 2>$null | Out-String
$ErrorActionPreference = $previousPreference
$report = $result -split "`n" | Select-String 'PASS:|FAIL:'
$report
if (-not ($result -match 'PASS:')) { throw "Scene regression checks failed. Artifacts: $testDir" }
