# tp-issue-scheduler.ps1
# Auto-run Claude CLI to process GitHub Issues (triggered by Windows Task Scheduler)

$projectDir = "C:\Users\RayChiu\Desktop\Source\GithubRepos\trip-planner"
$logFile = "$projectDir\scripts\tp-issue.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Add-Content $logFile "[$timestamp] Start tp-issue"

Set-Location $projectDir
claude --dangerously-skip-permissions -p "/tp-issue" 2>&1 | Add-Content $logFile

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content $logFile "[$timestamp] Done"
Add-Content $logFile "---"
