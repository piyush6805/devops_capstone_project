param([string]$ClusterName = 'stockpilot-eks')
. "$PSScriptRoot/common.ps1"
foreach ($tool in @('aws','terraform','kubectl','helm')) { Require-Command $tool }
Invoke-Checked aws @('sts','get-caller-identity')
Invoke-Checked aws @('eks','update-kubeconfig','--region','ap-south-1','--name',$ClusterName,'--alias','stockpilot-aws')
$context = 'stockpilot-aws'
Invoke-Checked kubectl @('--context',$context,'apply','-f',"$ProjectRoot/k8s/namespace.yaml")
Invoke-Checked kubectl @('--context',$context,'apply','-f',"$ProjectRoot/k8s/gp3.yaml")
Ensure-DatabaseSecret $context
Push-Location "$ProjectRoot/terraform"
try {
    $role = (Invoke-Checked terraform @('output','-raw','load_balancer_role_arn')).Trim()
    $vpc = (Invoke-Checked terraform @('output','-raw','vpc_id')).Trim()
} finally { Pop-Location }
Invoke-Checked helm @('repo','add','eks','https://aws.github.io/eks-charts','--force-update')
Invoke-Checked helm @('repo','add','traefik','https://traefik.github.io/charts','--force-update')
Invoke-Checked helm @('repo','add','metrics-server','https://kubernetes-sigs.github.io/metrics-server/','--force-update')
Invoke-Checked helm @('repo','add','prometheus-community','https://prometheus-community.github.io/helm-charts','--force-update')
Invoke-Checked helm @('repo','update')
Invoke-Checked helm @('upgrade','--install','aws-load-balancer-controller','eks/aws-load-balancer-controller','--kube-context',$context,'-n','kube-system',
    '--set-string',"clusterName=$ClusterName",'--set-string','region=ap-south-1','--set-string',"vpcId=$vpc",
    '--set-string','serviceAccount.name=aws-load-balancer-controller','--set-string',"serviceAccount.annotations.eks\.amazonaws\.com/role-arn=$role",'--wait','--timeout','5m')
Invoke-Checked helm @('upgrade','--install','traefik','traefik/traefik','--version','41.7.1','--kube-context',$context,'-n','ingress','--create-namespace','-f',"$ProjectRoot/k8s/traefik-aws.yaml",'--wait','--timeout','10m')
Invoke-Checked helm @('upgrade','--install','metrics-server','metrics-server/metrics-server','--version','3.14.0','--kube-context',$context,'-n','kube-system','--wait','--timeout','5m')
& kubectl --context $context create namespace monitoring --dry-run=client -o json | & kubectl --context $context apply -f - | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Monitoring namespace creation failed' }
& kubectl --context $context -n monitoring get secret stockpilot-grafana -o name 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    @{apiVersion='v1';kind='Secret';metadata=@{name='stockpilot-grafana';namespace='monitoring'};type='Opaque';stringData=@{'admin-user'='admin';'admin-password'=(New-HexPassword)}} | ConvertTo-Json -Depth 5 | & kubectl --context $context apply -f - | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Grafana secret creation failed' }
}
Invoke-Checked helm @('upgrade','--install','monitoring','prometheus-community/kube-prometheus-stack','--version','92.3.0','--kube-context',$context,'-n','monitoring','-f',"$ProjectRoot/monitoring/prometheus-values.yaml",'--wait','--timeout','10m')
Invoke-Checked kubectl @('--context',$context,'apply','-f',"$ProjectRoot/monitoring/dashboard.yaml")
Write-Host 'AWS prerequisites ready. Enable the optional GitHub deploy job after configuring its repository variables.'
