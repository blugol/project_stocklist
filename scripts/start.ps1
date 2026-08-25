Set-Location (Split-Path $PSScriptRoot -Parent)
$env:Path = "C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;" + $env:Path

function Test-Ready {
  try {
    Invoke-WebRequest -UseBasicParsing "http://localhost:5173/" -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Open-App {
  Start-Process "http://localhost:5173/"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is required. https://nodejs.org"
  Read-Host "Press Enter"
  exit 1
}

if (Test-Ready) {
  Open-App
  exit 0
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing packages..."
  & npm.cmd install
  if ($LASTEXITCODE -ne 0) {
    Read-Host "Install failed. Press Enter"
    exit 1
  }
}

Write-Host "Starting. Close this window to stop."
& npm.cmd run dev
$code = $LASTEXITCODE
if (Test-Ready) {
  Open-App
  exit 0
}
if ($code -ne 0) {
  Write-Host "Failed to start."
  Read-Host "Press Enter"
  exit $code
}
