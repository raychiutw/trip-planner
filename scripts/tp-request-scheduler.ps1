# tp-request-scheduler.ps1
# Fallback scheduler: only processes requests where webhook failed
# (Agent Server handles normal requests via Tunnel webhook)

$projectDir = Split-Path $PSScriptRoot
$logDir = Join-Path $PSScriptRoot "logs"
$logDate = Get-Date -Format "yyyy-MM-dd"
$logFile = Join-Path $logDir "tp-request-$logDate.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Create logs directory if not exists
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Log rotation: delete files older than 7 days
Get-ChildItem -Path $logDir -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -Force

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

# Check if there are webhook-failed requests before invoking Claude
$headers = @{
    "CF-Access-Client-Id" = $env:CF_ACCESS_CLIENT_ID
    "CF-Access-Client-Secret" = $env:CF_ACCESS_CLIENT_SECRET
}

try {
    $response = Invoke-RestMethod -Uri "https://trip-planner-dby.pages.dev/api/requests?status=open&webhook_failed=1" -Headers $headers -ErrorAction Stop
    if ($response.Count -eq 0) {
        # No webhook-failed requests, skip
        exit 0
    }
    Add-Content -Path $logFile -Value "[$timestamp] Found $($response.Count) webhook-failed request(s), processing..." -Encoding UTF8
} catch {
    Add-Content -Path $logFile -Value "[$timestamp] API check failed: $_" -Encoding UTF8
    exit 1
}

Set-Location $projectDir
$output = claude --dangerously-skip-permissions -p "/tp-request" 2>&1 | Out-String
$output | Add-Content -Path $logFile -Encoding UTF8

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$timestamp] Done" -Encoding UTF8
Add-Content -Path $logFile -Value "---" -Encoding UTF8
