# register-daily-check.ps1
# Register TripPlanner-DailyCheck in Windows Task Scheduler (run once)
# Runs `claude -p "/tp-daily-check"` every day at 06:13

$projectDir = Split-Path $PSScriptRoot

$action = New-ScheduledTaskAction `
    -Execute "claude" `
    -Argument "--dangerously-skip-permissions -p ""/tp-daily-check""" `
    -WorkingDirectory $projectDir

$trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At "06:13"

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName "TripPlanner-DailyCheck" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Run Claude CLI /tp-daily-check every day at 06:13"

Write-Host "Registered: TripPlanner-DailyCheck (daily at 06:13)"
Write-Host "  Manage: taskschd.msc > TripPlanner-DailyCheck"
