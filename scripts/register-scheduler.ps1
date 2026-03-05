# register-scheduler.ps1
# Register TripPlanner-AutoIssue in Windows Task Scheduler (run once)

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File ""C:\Users\RayChiu\Desktop\Source\GithubRepos\trip-planner\scripts\tp-issue-scheduler.ps1""" `
    -WorkingDirectory "C:\Users\RayChiu\Desktop\Source\GithubRepos\trip-planner"

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
    -TaskName "TripPlanner-AutoIssue" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Auto-run Claude CLI tp-issue every 15 minutes"

Write-Host "Registered: TripPlanner-AutoIssue (every 15 min)"
Write-Host "  Manage: taskschd.msc > TripPlanner-AutoIssue"
