$ErrorActionPreference = 'Stop'
$desktopBuildRoot = $PSScriptRoot
$desktopRelease = Get-Content -LiteralPath (Join-Path $desktopBuildRoot 'electron-release.json') -Raw | ConvertFrom-Json
$desktopArchive = Join-Path $desktopBuildRoot ('.cache/electron-v' + $desktopRelease.version + '-win32-x64.zip')
if (-not (Test-Path -LiteralPath $desktopArchive)) {
    New-Item -ItemType Directory -Path (Join-Path $desktopBuildRoot '.cache') -Force | Out-Null
    Invoke-WebRequest -Uri $desktopRelease.url -OutFile $desktopArchive
}
if ((Get-Item -LiteralPath $desktopArchive).Length -ne $desktopRelease.expectedBytes) { throw 'Electron archive length does not match the official release.' }
$desktopBundle = Join-Path $desktopBuildRoot 'dist/HinataPet-Windows-x64-0.1.0'
if (-not (Test-Path -LiteralPath (Join-Path $desktopBundle 'HinataPet.exe'))) {
    Expand-Archive -LiteralPath $desktopArchive -DestinationPath $desktopBundle
    Rename-Item -LiteralPath (Join-Path $desktopBundle 'electron.exe') -NewName 'HinataPet.exe'
}
$desktopApp = Join-Path $desktopBundle 'resources/app'
# Only the generated runtime folder needs read/execute permission for Electron's AppContainer children.
& icacls.exe $desktopBundle /grant '*S-1-15-2-1:(OI)(CI)(RX)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Electron runtime AppContainer read access could not be set.' }
New-Item -ItemType Directory -Path $desktopApp -Force | Out-Null
foreach ($desktopFile in @('package.json','main.cjs','preload.cjs','window-physics.cjs','self-test.cjs','renderer.js','pet.html','pet.css')) {
    Copy-Item -LiteralPath (Join-Path $desktopBuildRoot $desktopFile) -Destination (Join-Path $desktopApp $desktopFile) -Force
}
Copy-Item -LiteralPath (Join-Path $desktopBuildRoot 'assets') -Destination $desktopApp -Recurse -Force
Copy-Item -LiteralPath (Join-Path $desktopBuildRoot '使用说明.txt') -Destination $desktopBundle -Force
[pscustomobject]@{ electronVersion = $desktopRelease.version; archiveSHA256 = (Get-FileHash -LiteralPath $desktopArchive -Algorithm SHA256).Hash; architecture = 'win32-x64'; applicationVersion = '0.1.0' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $desktopBundle 'build-info.json') -Encoding utf8
Write-Output (Join-Path $desktopBundle 'HinataPet.exe')
