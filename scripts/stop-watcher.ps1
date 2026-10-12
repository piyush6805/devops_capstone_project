. "$PSScriptRoot/common.ps1"
$recordPath = "$ProjectRoot/.local/watcher-process.json"
if (-not (Test-Path -LiteralPath $recordPath)) { Write-Host 'No managed watcher has been started.'; return }
$record = Get-Content -Raw -LiteralPath $recordPath | ConvertFrom-Json
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $($record.processId)" -ErrorAction SilentlyContinue
if (-not $process) { Write-Host 'The managed watcher is already stopped.'; return }
if (-not $process.CommandLine -or -not $process.CommandLine.Replace('\','/').Contains("$ProjectRoot/scripts/watch-deploy.ps1".Replace('\','/'))) { throw 'PID now belongs to another process; refusing to stop it.' }
$busyChildren = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($record.processId)" | Where-Object { $_.Name -in @('helm.exe','gh.exe','kubectl.exe','docker.exe','kind.exe') })
if ($busyChildren.Count) { throw 'The watcher is checking or deploying a release. Wait for that operation to finish, then stop it; an active deployment must not be interrupted.' }
Stop-Process -Id $record.processId -ErrorAction Stop
Write-Host "Stopped this project's deployment watcher (PID $($record.processId))."
