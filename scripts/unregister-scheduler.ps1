# unregister-scheduler.ps1
# Remove TripPlanner-AutoIssue from Windows Task Scheduler (run once)

Unregister-ScheduledTask -TaskName "TripPlanner-AutoIssue" -Confirm:$false

Write-Host "Removed: TripPlanner-AutoIssue"
