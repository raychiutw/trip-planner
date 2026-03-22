# register-daily-check.ps1
# Register TripPlanner-DailyCheck in Windows Task Scheduler (run once)
# Runs claude in interactive mode at 06:13, piping /tp-daily-check as initial prompt
# Claude session stays open for Telegram interaction (up to 4 hours)

$projectDir = Split-Path $PSScriptRoot

# 互動模式：用 cmd /c 啟動 claude，保持 session 開著
$action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"cd /d $projectDir && echo /tp-daily-check | claude --dangerously-skip-permissions`"" `
    -WorkingDirectory $projectDir

$trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At "06:13"

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4)

Register-ScheduledTask `
    -TaskName "TripPlanner-DailyCheck" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Run Claude CLI /tp-daily-check every day at 06:13 (interactive mode, waits for Telegram replies)"

Write-Host "Registered: TripPlanner-DailyCheck (daily at 06:13, interactive mode)"
Write-Host "  Session stays open up to 4 hours for Telegram interaction"
Write-Host "  Manage: taskschd.msc > TripPlanner-DailyCheck"
