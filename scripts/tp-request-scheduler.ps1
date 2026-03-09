# tp-request-scheduler.ps1
# Auto-run Claude CLI to process GitHub Requests (triggered by Windows Task Scheduler)

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

Add-Content -Path $logFile -Value "[$timestamp] Start tp-request" -Encoding UTF8

Set-Location $projectDir
$output = claude --dangerously-skip-permissions -p "/tp-request" 2>&1 | Out-String
$output | Add-Content -Path $logFile -Encoding UTF8

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$timestamp] Done" -Encoding UTF8
Add-Content -Path $logFile -Value "---" -Encoding UTF8
