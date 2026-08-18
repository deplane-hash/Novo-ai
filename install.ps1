$ErrorActionPreference = 'Stop'

$Base = 'https://freedomhub.at'
$Tar = "$Base/dl/nova-0.1.0.tgz"

function Update-Path {
  $m = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $u = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = ($m + ';' + $u).Trim(';')
}
function Have([string]$cmd) {
  return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

Write-Host ""
Write-Host "  Nova - AI workspace client"
Write-Host "  Installing for this PC..."

# Allow running locally-installed npm shims (nova.ps1) without prompts.
$policy = Get-ExecutionPolicy -Scope CurrentUser -ErrorAction SilentlyContinue
if ($policy -eq 'Restricted' -or $policy -eq 'AllSigned') {
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
}

Update-Path

# --- Locate or install Node.js ---
$nodeCandidates = @(
  "$env:ProgramFiles\nodejs",
  "${env:ProgramFiles(x86)}\nodejs",
  "$env:LOCALAPPDATA\Programs\nodejs",
  "$env:LOCALAPPDATA\nvm\nodejs"
)
$nodeDir = $null
foreach ($d in $nodeCandidates) {
  if (Test-Path "$d\node.exe") { $nodeDir = $d; break }
}

if (-not $nodeDir) {
  Write-Host "  • Node.js not found, installing LTS..."
  if (Have winget) {
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent | Out-Null
    Update-Path
    foreach ($d in $nodeCandidates) {
      if (Test-Path "$d\node.exe") { $nodeDir = $d; break }
    }
  }
}

if (-not $nodeDir) {
  Write-Host ""
  Write-Host "  ✗ Could not find Node.js. Install it from https://nodejs.org (LTS),"
  Write-Host "    then close this terminal, reopen it, and run the command again."
  exit 1
}

if ($env:Path -notlike "*$nodeDir*") {
  $env:Path = "$nodeDir;$env:Path"
}

$npmCmd = Join-Path $nodeDir 'npm.cmd'
if (-not (Test-Path $npmCmd)) {
  Write-Host "  ✗ npm not found next to Node. Reinstall from https://nodejs.org (LTS)."
  exit 1
}

# --- Download and install the client ---
$tmp = Join-Path $env:TEMP 'nova-0.1.0.tgz'
$expected = 140276
$size = 0
$tries = 0
Write-Host "  • Downloading client..."
while ($tries -lt 5 -and $size -ne $expected) {
  $tries++
  if ($tries -gt 1) { Write-Host "  • download incomplete, retrying... ($tries/5)" }
  curl.exe -fsSL --retry 2 --retry-delay 1 --max-time 90 -o $tmp $Tar 2>$null
  $size = if (Test-Path $tmp) { (Get-Item $tmp).Length } else { 0 }
}
if ($size -ne $expected) {
  Write-Host "  ✗ Download failed. Run the command again in a moment."
  exit 1
}

Write-Host "  • Installing... (this can take a minute)"
& $npmCmd i -g $tmp --no-fund --no-audit | Out-Null
if ($LASTEXITCODE -ne 0) { exit 1 }

# --- Make sure `nova` is runnable from any new terminal ---
$npmGlobal = "$env:APPDATA\npm"
if ($npmGlobal -ne $nodeDir) {
  $u = [Environment]::GetEnvironmentVariable('Path', 'User')
  if ($u -notlike "*$npmGlobal*") {
    [Environment]::SetEnvironmentVariable('Path', "$u;$npmGlobal", 'User')
  }
}

Write-Host ""
Write-Host "  ✔ Nova installed!"
Write-Host "  Start it now by typing:"
Write-Host ""
Write-Host "      nova"
Write-Host ""
Write-Host "  (or, in future terminals, just: nova)"