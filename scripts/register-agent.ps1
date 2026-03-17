# register-agent.ps1 — Register agent server as Windows Task Scheduler task
$projectDir = Split-Path $PSScriptRoot
$startScript = Join-Path $PSScriptRoot "start-agent.ps1"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`"" `
    -WorkingDirectory $projectDir

$trigger = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName "TripPlanner-AgentServer" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Trip Planner local agent server + Cloudflare Tunnel"

Write-Host "Registered: TripPlanner-AgentServer (at logon)"
Write-Host "  Manage: taskschd.msc > TripPlanner-AgentServer"
