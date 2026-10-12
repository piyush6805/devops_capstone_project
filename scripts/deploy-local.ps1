param(
    [string]$Commit = 'local',
    [string]$BackendImage = 'stockpilot-backend',
    [string]$FrontendImage = 'stockpilot-frontend',
    [string]$ChartPath = '',
    [switch]$PublishedImages,
    [switch]$SkipMonitoring
)
. "$PSScriptRoot/common.ps1"
if ($Commit -notmatch '^(local|[a-f0-9]{40})$') { throw 'Commit must be local or a full lowercase Git commit SHA.' }
if (-not $ChartPath) { $ChartPath = "$ProjectRoot/helm/stockpilot" }
$context = 'kind-stockpilot'
Invoke-Checked kubectl @('--context',$context,'get','nodes')
Ensure-DatabaseSecret $context
if (-not $PublishedImages) {
    Invoke-Checked docker @('build','-t',"${BackendImage}:$Commit","$ProjectRoot/backend")
    Invoke-Checked docker @('build','-t',"${FrontendImage}:$Commit","$ProjectRoot/frontend")
    Invoke-Checked kind @('load','docker-image',"${BackendImage}:$Commit","${FrontendImage}:$Commit",'--name','stockpilot')
}
$arguments = @('upgrade','--install','stockpilot',$ChartPath,'--kube-context',$context,'-n','stockpilot','-f',"$ChartPath/values-local.yaml",
    '--set-string',"backend.image=$BackendImage",'--set-string',"frontend.image=$FrontendImage",
    '--set-string',"backend.tag=$Commit",'--set-string',"frontend.tag=$Commit",'--atomic','--wait','--wait-for-jobs','--timeout','10m')
if ($SkipMonitoring) { $arguments += @('--set','monitoring.enabled=false') }
Invoke-Checked helm $arguments
$response = Invoke-RestMethod 'http://127.0.0.1:8080/api/version' -Headers @{Host='stockpilot.localhost'} -TimeoutSec 15
if ($response.commit -ne $Commit) { throw "Version mismatch: expected $Commit, received $($response.commit)" }
Write-Host "Deployed $Commit at http://stockpilot.localhost:8080"
