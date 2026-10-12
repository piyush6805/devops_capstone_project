param([Parameter(Mandatory)][string]$Repository, [switch]$Once, [int]$PollSeconds = 60)
. "$PSScriptRoot/common.ps1"
Require-Command gh
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Repository must be owner/repository.' }
if ($PollSeconds -lt 60) { throw 'PollSeconds must be at least 60.' }
Invoke-Checked gh @('auth','status')
Invoke-Checked kubectl @('--context','kind-stockpilot','get','nodes')
$stateDir = "$ProjectRoot/.local"
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$stateFile = "$stateDir/deployed-$($Repository.Replace('/','-')).json"
$lockFile = "$stateDir/watcher.lock"
try { $lock = [IO.File]::Open($lockFile,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None) }
catch { throw 'Another watcher is already running.' }
try {
    do {
        try {
            $runs = Invoke-Checked gh @('api',"repos/$Repository/actions/workflows/ci-cd.yml/runs?branch=main&event=push&status=success&per_page=1") | ConvertFrom-Json
            if ($runs.workflow_runs.Count -gt 0) {
                $run = $runs.workflow_runs[0]
                $branch = Invoke-Checked gh @('api',"repos/$Repository/branches/main") | ConvertFrom-Json
                $state = if (Test-Path -LiteralPath $stateFile) { Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json } else { $null }
                if ($run.head_sha -eq $branch.commit.sha -and ($null -eq $state -or ([long]$run.id -gt [long]$state.runId -and $run.head_sha -ne $state.commit))) {
                    $downloadDir = Join-Path $stateDir "release-$($run.id)"
                    if (-not (Test-Path -LiteralPath "$downloadDir/release.json")) {
                        New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
                        Invoke-Checked gh @('run','download',[string]$run.id,'--repo',$Repository,'--name','stockpilot-deployment','--dir',$downloadDir)
                    }
                    $release = Get-Content -Raw -LiteralPath "$downloadDir/release.json" | ConvertFrom-Json
                    $expectedPrefix = "ghcr.io/$($Repository.ToLowerInvariant())"
                    if ($release.commit -ne $run.head_sha -or $release.repository -ine $Repository -or $release.backendImage -ne "$expectedPrefix-backend" -or $release.frontendImage -ne "$expectedPrefix-frontend") { throw 'Deployment artifact does not match the successful run and expected image repositories.' }
                    & "$PSScriptRoot/deploy-local.ps1" -Commit $release.commit -BackendImage $release.backendImage -FrontendImage $release.frontendImage -ChartPath "$downloadDir/chart" -PublishedImages
                    @{runId=$run.id;commit=$release.commit;url=$run.html_url} | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath $stateFile
                }
            }
        } catch {
            if ($Once) { throw }
            Write-Warning "Deployment check failed; state not advanced. $($_.Exception.Message)"
        }
        if (-not $Once) { Start-Sleep -Seconds $PollSeconds }
    } while (-not $Once)
} finally { $lock.Dispose() }
