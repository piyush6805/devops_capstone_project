param([switch]$SkipMonitoring)
. "$PSScriptRoot/common.ps1"
foreach ($tool in @('docker','kind','kubectl','helm')) { Require-Command $tool }
Invoke-Checked docker @('info','--format','{{.ServerVersion}}')
$clusters = & kind get clusters
if ($LASTEXITCODE -ne 0) { throw 'Unable to list Kind clusters' }
if ($clusters -notcontains 'stockpilot') {
    Invoke-Checked kind @('create','cluster','--name','stockpilot','--config',"$ProjectRoot/k8s/kind.yaml",'--wait','180s')
}
$context = 'kind-stockpilot'
Invoke-Checked kubectl @('--context',$context,'apply','-f',"$ProjectRoot/k8s/namespace.yaml")
Ensure-DatabaseSecret $context
Invoke-Checked helm @('repo','add','traefik','https://traefik.github.io/charts','--force-update')
Invoke-Checked helm @('repo','add','metrics-server','https://kubernetes-sigs.github.io/metrics-server/','--force-update')
Invoke-Checked helm @('repo','add','prometheus-community','https://prometheus-community.github.io/helm-charts','--force-update')
Invoke-Checked helm @('repo','update')
Invoke-Checked helm @('upgrade','--install','traefik','traefik/traefik','--version','41.7.1','--kube-context',$context,'-n','ingress','--create-namespace','-f',"$ProjectRoot/k8s/traefik-local.yaml",'--wait','--timeout','5m')
Invoke-Checked helm @('upgrade','--install','metrics-server','metrics-server/metrics-server','--version','3.14.0','--kube-context',$context,'-n','kube-system','--set','args={--kubelet-insecure-tls}','--wait','--timeout','5m')
if (-not $SkipMonitoring) {
    Invoke-Checked kubectl @('--context',$context,'create','namespace','monitoring','--dry-run=client','-o','json') | & kubectl --context $context apply -f - | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Monitoring namespace creation failed' }
    & kubectl --context $context -n monitoring get secret stockpilot-grafana -o name 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $password = New-HexPassword
        @{apiVersion='v1';kind='Secret';metadata=@{name='stockpilot-grafana';namespace='monitoring'};type='Opaque';stringData=@{'admin-user'='admin';'admin-password'=$password}} | ConvertTo-Json -Depth 5 | & kubectl --context $context apply -f - | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Grafana secret creation failed' }
    }
    Invoke-Checked helm @('upgrade','--install','monitoring','prometheus-community/kube-prometheus-stack','--version','92.3.0','--kube-context',$context,'-n','monitoring','-f',"$ProjectRoot/monitoring/prometheus-values.yaml",'--wait','--timeout','10m')
    Invoke-Checked kubectl @('--context',$context,'wait','--for=condition=Established','crd/servicemonitors.monitoring.coreos.com','--timeout=120s')
    Invoke-Checked kubectl @('--context',$context,'apply','-f',"$ProjectRoot/monitoring/dashboard.yaml")
}
Write-Host 'Local prerequisites ready. Run scripts/deploy-local.ps1 to build and deploy StockPilot.'
