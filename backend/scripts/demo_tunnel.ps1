<#
Demo day: a fresh Cloudflare quick tunnel to the local backend, with
backend/.env pointed at it, so PayFast's payment page and its payment
notice reach this laptop. A quick tunnel gets a new address every time it
starts, and it can expire, so run this shortly before the demo.

  cd backend
  powershell -ExecutionPolicy Bypass -File .\scripts\demo_tunnel.ps1

Then restart the backend so it reads the new APP_BASE_URL. Keep this
window open: closing it closes the tunnel. Needs cloudflared
(winget install Cloudflare.cloudflared). Development only: it prints the
tunnel address and nothing else from .env.
#>
$ErrorActionPreference = 'Stop'

$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) { $cf = 'C:\Program Files (x86)\cloudflared\cloudflared.exe' }
if (-not (Test-Path $cf)) { throw 'cloudflared not found. Install it: winget install Cloudflare.cloudflared' }
$envFile = Join-Path $PSScriptRoot '..\.env'
if (-not (Test-Path $envFile)) { throw 'backend/.env not found' }

$log = Join-Path $env:TEMP 'akayza-tunnel.log'
Remove-Item $log -ErrorAction SilentlyContinue
$tunnel = Start-Process -FilePath $cf -ArgumentList 'tunnel', '--no-autoupdate', '--url', 'http://localhost:5000' -RedirectStandardError $log -PassThru -WindowStyle Hidden

$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value }
  }
}
if (-not $url) {
  Stop-Process -Id $tunnel.Id -Force
  throw "The tunnel didn't start. Its log: $log"
}

# Point APP_BASE_URL at the tunnel; every other line of .env stays as it is.
$out = New-Object System.Collections.Generic.List[string]
$found = $false
foreach ($line in [IO.File]::ReadAllLines($envFile)) {
  if ($line -match '^APP_BASE_URL=') { $out.Add("APP_BASE_URL=$url"); $found = $true } else { $out.Add($line) }
}
if (-not $found) { $out.Add("APP_BASE_URL=$url") }
[IO.File]::WriteAllLines((Resolve-Path $envFile), $out)  # UTF-8 without a BOM, which python-dotenv needs

$trust = Select-String -Path $envFile -Pattern '^PAYFAST_TRUST_PROXY=true' -Quiet
Write-Host "Tunnel up: $url"
Write-Host 'backend/.env: APP_BASE_URL now points at it.'
if (-not $trust) { Write-Host 'Also set PAYFAST_TRUST_PROXY=true in backend/.env, or PayFast''s payment notice will be refused behind the tunnel.' }
Write-Host 'Now restart the backend the way you started it (Ctrl+C in its window, then start it again). Keep this window open.'
Write-Host 'Press Ctrl+C here to close the tunnel when the demo is over.'
try { Wait-Process -Id $tunnel.Id } finally { if (-not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force } }
