. "$PSScriptRoot/common.ps1"
$directory = "$ProjectRoot/artifacts"
New-Item -ItemType Directory -Force -Path $directory | Out-Null
Push-Location $ProjectRoot
try {
    Invoke-Checked git @('log','--oneline','--decorate') | Set-Content -Encoding utf8 "$directory/commit-history.txt"
    Invoke-Checked docker @('compose','ps') | Set-Content -Encoding utf8 "$directory/compose-status.txt"
    Invoke-Checked kubectl @('--context','kind-stockpilot','get','pods,svc,ingress,hpa,pvc,jobs','-n','stockpilot') | Set-Content -Encoding utf8 "$directory/kubernetes-status.txt"
    Invoke-Checked helm @('--kube-context','kind-stockpilot','list','-A') | Set-Content -Encoding utf8 "$directory/helm-releases.txt"
    Invoke-Checked kubectl @('--context','kind-stockpilot','top','pods','-n','stockpilot') | Set-Content -Encoding utf8 "$directory/resource-usage.txt"
    Invoke-RestMethod http://127.0.0.1:8080/api/version -Headers @{Host='stockpilot.localhost'} | ConvertTo-Json | Set-Content -Encoding utf8 "$directory/deployed-version.json"
    Invoke-WebRequest http://127.0.0.1:8000/metrics -OutFile "$directory/backend-metrics.txt"
    Write-Host 'Saved local evidence under artifacts/. Capture browser and remote run screenshots separately.'
} finally { Pop-Location }
