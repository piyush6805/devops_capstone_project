param([string]$Repository = 'piyush6805/devops_capstone_project')
. "$PSScriptRoot/common.ps1"
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Repository must be owner/repository.' }
Require-Command gh
Invoke-Checked gh @('auth','status')
Invoke-Checked kubectl @('--context','kind-stockpilot','get','nodes')
$directory = "$ProjectRoot/.local"
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$recordPath = "$directory/watcher-process.json"
if (Test-Path -LiteralPath $recordPath) {
    $record = Get-Content -Raw -LiteralPath $recordPath | ConvertFrom-Json
    $existing = Get-CimInstance Win32_Process -Filter "ProcessId = $($record.processId)" -ErrorAction SilentlyContinue
    if ($existing -and $existing.CommandLine -and $existing.CommandLine.Replace('\','/').Contains("$ProjectRoot/scripts/watch-deploy.ps1".Replace('\','/'))) {
        if ($record.repository -ne $Repository) { throw 'A watcher for another repository is running. Stop it before switching repositories.' }
        Write-Host "Watcher already running (PID $($record.processId)). Logs: $directory/watcher-output.log"
        return
    }
}
$shell = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if (-not $shell) { $shell = (Get-Command powershell).Source }
$script = "$ProjectRoot/scripts/watch-deploy.ps1"
$process = Start-Process -FilePath $shell -ArgumentList @('-NoProfile','-NonInteractive','-File',('"'+$script+'"'),'-Repository',$Repository) `
    -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput "$directory/watcher-output.log" -RedirectStandardError "$directory/watcher-errors.log" -PassThru
Start-Sleep -Seconds 2
$process.Refresh()
if ($process.HasExited) { throw "Watcher exited on startup. Read $directory/watcher-errors.log" }
@{processId=$process.Id;repository=$Repository;startedAt=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath $recordPath
Write-Host "Automatic watcher running (PID $($process.Id)); polls successful main runs every 60 seconds."
Write-Host "Logs: $directory/watcher-output.log and watcher-errors.log. Stop with scripts/stop-watcher.ps1."
