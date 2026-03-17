# start-agent.ps1 — Start agent server + Cloudflare Quick Tunnel
# Quick Tunnel 每次啟動拿到隨機 URL，透過 KV 即時更新（Pages Function 立刻讀到）

$projectDir = Split-Path $PSScriptRoot
$cloudflared = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe"

if (-not (Test-Path $cloudflared)) {
    $cloudflared = "cloudflared"
}

# Start Quick Tunnel in background, redirect stderr to log file
$logFile = Join-Path $projectDir "server\tunnel.log"
$tunnelProcess = Start-Process -NoNewWindow -PassThru -RedirectStandardError $logFile $cloudflared "tunnel --url http://localhost:3001 --protocol http2"
Write-Host "Quick Tunnel starting (PID: $($tunnelProcess.Id))..."

# Wait for tunnel URL to appear in log
$tunnelUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Path $logFile) {
        $content = Get-Content $logFile -Raw
        if ($content -match '(https://[a-z0-9-]+\.trycloudflare\.com)') {
            $tunnelUrl = $matches[1]
            break
        }
    }
}

if ($tunnelUrl) {
    Write-Host "Tunnel URL: $tunnelUrl"

    # Update KV (instant, no deploy needed)
    try {
        Set-Location $projectDir
        npx wrangler kv key put "TUNNEL_URL" $tunnelUrl --namespace-id "9d4ced7109da4330ad12f0d5bd88d425" 2>$null
        Write-Host "Updated TUNNEL_URL in KV (instant)"
    } catch {
        Write-Host "WARNING: Failed to update KV: $_"
    }
} else {
    Write-Host "WARNING: Could not detect tunnel URL after 60s"
}

# Start node server (foreground)
try {
    Set-Location (Join-Path $projectDir "server")
    $env:TUNNEL_URL = $tunnelUrl
    node index.js
} finally {
    # Cleanup tunnel on exit
    if (-not $tunnelProcess.HasExited) {
        Stop-Process $tunnelProcess -Force
        Write-Host "Tunnel stopped"
    }
    if (Test-Path $logFile) { Remove-Item $logFile -Force }
}
