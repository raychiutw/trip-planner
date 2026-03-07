# tp-issue-scheduler.ps1
# Auto-run Claude CLI to process GitHub Issues (triggered by Windows Task Scheduler)

$projectDir = Split-Path $PSScriptRoot
$logFile = Join-Path $PSScriptRoot "tp-issue.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

Add-Content -Path $logFile -Value "[$timestamp] Start tp-issue" -Encoding UTF8

Set-Location $projectDir
$output = claude --dangerously-skip-permissions -p "/tp-issue" 2>&1 | Out-String
$output | Add-Content -Path $logFile -Encoding UTF8

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$timestamp] Done" -Encoding UTF8
Add-Content -Path $logFile -Value "---" -Encoding UTF8
