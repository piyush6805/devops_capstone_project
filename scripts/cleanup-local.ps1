param([switch]$DeleteCluster)
. "$PSScriptRoot/common.ps1"
Push-Location $ProjectRoot
try { Invoke-Checked docker @('compose','down') } finally { Pop-Location }
if ($DeleteCluster) {
    Write-Host 'Deleting only the stockpilot Kind cluster, including its demo database.'
    Invoke-Checked kind @('delete','cluster','--name','stockpilot')
}
