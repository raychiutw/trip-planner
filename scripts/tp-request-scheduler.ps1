# tp-request-scheduler.ps1
# 每分鐘排程：查詢所有 open 請求並處理

$projectDir = Split-Path $PSScriptRoot
$logDir = Join-Path $PSScriptRoot "logs"
$logDate = Get-Date -Format "yyyy-MM-dd"
$logFile = Join-Path $logDir "tp-request-$logDate.log"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    [System.IO.File]::AppendAllText($logFile, "[$ts] $msg`r`n", $utf8NoBom)
}

# Create logs directory if not exists
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Log rotation: delete files older than 7 days
Get-ChildItem -Path $logDir -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -Force

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

Log "--- 排程啟動 ---"

# Query open requests
$headers = @{
    "CF-Access-Client-Id"     = "$CF_ACCESS_CLIENT_ID"
    "CF-Access-Client-Secret" = "$CF_ACCESS_CLIENT_SECRET"
    "Origin"                  = "https://trip-planner-dby.pages.dev"
}

Log "呼叫 API: GET /api/requests?status=open"

try {
    $rawJson = curl.exe -s `
        -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" `
        -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" `
        "https://trip-planner-dby.pages.dev/api/requests?status=open"
    $response = $rawJson | ConvertFrom-Json
}
catch {
    Log "API 呼叫失敗: $_"
    Log "--- 排程結束（錯誤）---"
    exit 1
}

$count = 0
if ($response -is [System.Array]) { $count = $response.Count } elseif ($response) { $count = 1 }

Log "查詢結果: $count 筆 open 請求"

if ($count -eq 0) {
    Log "--- 排程結束（無待處理）---"
    exit 0
}

# Log each request summary and PATCH status → received
for ($i = 0; $i -lt $count; $i++) {
    $req = if ($response -is [System.Array]) { $response[$i] } else { $response }
    $rid = $req.id
    $tripId = $req.trip_id
    $mode = $req.mode
    $msg = if ($req.message) { $req.message.Substring(0, [Math]::Min(50, $req.message.Length)) } else { "(empty)" }
    Log "  [$($i+1)/$count] id=$rid trip=$tripId mode=$mode msg=$msg"

    # PATCH status → received（系統已接收）— 使用 curl 避免 PowerShell 過濾 headers
    try {
        $patchResult = curl.exe -s -X PATCH `
            -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" `
            -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" `
            -H "Content-Type: application/json" `
            -d "{`"status`":`"received`"}" `
            "https://trip-planner-dby.pages.dev/api/requests/$rid"
        Log "  id=$rid status → received ($patchResult)"
    }
    catch {
        Log "  id=$rid PATCH received 失敗: $_"
    }
}

# Invoke Claude tp-request
Log "開始處理: claude /tp-request"

Set-Location $projectDir
try {
    $output = claude --dangerously-skip-permissions -p "/tp-request" 2>&1 | Out-String
    [System.IO.File]::AppendAllText($logFile, $output + "`r`n", $utf8NoBom)
    Log "處理完成"
}
catch {
    Log "Claude 執行失敗: $_"

    # 回滾：將所有已設為 received 的請求退回 open
    for ($i = 0; $i -lt $count; $i++) {
        $req = if ($response -is [System.Array]) { $response[$i] } else { $response }
        $rid = $req.id
        try {
            $rollbackResult = curl.exe -s -X PATCH `
                -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" `
                -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" `
                -H "Content-Type: application/json" `
                -d "{`"status`":`"open`"}" `
                "https://trip-planner-dby.pages.dev/api/requests/$rid"
            Log "  id=$rid 回滾 status → open ($rollbackResult)"
        }
        catch {
            Log "  id=$rid 回滾失敗: $_"
        }
    }

    Log "--- 排程結束（錯誤）---"
    exit 1
}

Log "--- 排程結束 ---"
