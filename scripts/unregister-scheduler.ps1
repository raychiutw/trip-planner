# unregister-scheduler.ps1
# Remove TripPlanner-AutoRequest from Windows Task Scheduler (run once)

Unregister-ScheduledTask -TaskName "TripPlanner-AutoRequest" -Confirm:$false

Write-Host "Removed: TripPlanner-AutoRequest"
