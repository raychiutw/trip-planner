try {
    $r = Invoke-WebRequest -Uri 'https://trip-planner-dby.pages.dev/api/trips/okinawa-trip-2026-HuiYun' -UseBasicParsing
    Write-Host "Status: $($r.StatusCode)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
