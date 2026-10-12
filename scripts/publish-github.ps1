param([string]$RepositoryName = 'stockpilot-devops-capstone')
. "$PSScriptRoot/common.ps1"
Require-Command gh
Invoke-Checked gh @('auth','status')
if ($RepositoryName -notmatch '^[A-Za-z0-9_.-]+$') { throw 'Provide a repository name without owner or path.' }
Push-Location $ProjectRoot
try {
    $owner = (Invoke-Checked gh @('api','user','--jq','.login')).Trim()
    & git remote get-url origin 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Invoke-Checked gh @('repo','create',"$owner/$RepositoryName",'--public','--source','.','--remote','origin','--push','--description','StockPilot inventory capstone: React, FastAPI, PostgreSQL and the complete DevOps delivery pipeline')
    } else {
        Invoke-Checked git @('push','-u','origin','main')
    }
    Write-Host "GitHub: https://github.com/$owner/$RepositoryName"
    Write-Host 'After the first successful build, make BOTH GHCR packages public in their Package settings.'
    Write-Host "Watcher: ./scripts/watch-deploy.ps1 -Repository $owner/$RepositoryName"
} finally { Pop-Location }
