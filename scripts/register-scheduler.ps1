# register-scheduler.ps1
# Register TripPlanner-AutoRequest in Windows Task Scheduler (run once)

$projectDir = Split-Path $PSScriptRoot
$schedulerScript = Join-Path $PSScriptRoot "tp-request-scheduler.ps1"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""$schedulerScript""" `
    -WorkingDirectory $projectDir

$trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At "06:23"

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
    -Description "Auto-run Claude CLI tp-request daily at 06:23"

Write-Host "Registered: TripPlanner-AutoRequest (daily at 06:23)"
Write-Host "  Manage: taskschd.msc > TripPlanner-AutoRequest"
