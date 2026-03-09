# register-scheduler.ps1
# Register TripPlanner-AutoRequest in Windows Task Scheduler (run once)

$projectDir = Split-Path $PSScriptRoot
$schedulerScript = Join-Path $PSScriptRoot "tp-request-scheduler.ps1"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""$schedulerScript""" `
    -WorkingDirectory $projectDir

$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 15) `
    -RepetitionDuration (New-TimeSpan -Days 365)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName "TripPlanner-AutoRequest" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Auto-run Claude CLI tp-request every 15 minutes"

Write-Host "Registered: TripPlanner-AutoRequest (every 15 min)"
Write-Host "  Manage: taskschd.msc > TripPlanner-AutoRequest"
