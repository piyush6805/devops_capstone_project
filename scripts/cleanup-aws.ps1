param([switch]$DestroyInfrastructure)
. "$PSScriptRoot/common.ps1"
$context = 'stockpilot-aws'
Invoke-Checked kubectl @('--context',$context,'get','nodes')
$claims = Invoke-Checked kubectl @('--context',$context,'get','pvc','-n','stockpilot','-o','json') | ConvertFrom-Json
$volumeIds = @()
foreach ($claim in $claims.items) {
    if ($claim.spec.volumeName) {
        $pv = Invoke-Checked kubectl @('--context',$context,'get','pv',$claim.spec.volumeName,'-o','json') | ConvertFrom-Json
        if ($pv.spec.csi.driver -eq 'ebs.csi.aws.com') { $volumeIds += $pv.spec.csi.volumeHandle }
    }
}
Invoke-Checked kubectl @('--context',$context,'delete','-f',"$ProjectRoot/argocd/stockpilot-application.yaml",'--wait=true','--timeout=10m')
Invoke-Checked kubectl @('--context',$context,'delete','-f',"$ProjectRoot/argocd/stockpilot-project.yaml",'--wait=true','--timeout=2m')
Invoke-Checked kubectl @('--context',$context,'delete','pvc','--all','-n','stockpilot','--wait=true','--timeout=300s')
foreach ($volume in $volumeIds) { Invoke-Checked aws @('ec2','wait','volume-deleted','--region','ap-south-1','--volume-ids',$volume) }
# Keep the AWS Load Balancer Controller alive until the Service finalizer deletes its NLB.
Invoke-Checked helm @('--kube-context',$context,'uninstall','traefik','-n','ingress','--wait','--timeout','10m')
Invoke-Checked helm @('--kube-context',$context,'uninstall','monitoring','-n','monitoring','--wait','--timeout','10m')
Invoke-Checked helm @('--kube-context',$context,'uninstall','aws-load-balancer-controller','-n','kube-system','--wait','--timeout','5m')
Invoke-Checked helm @('--kube-context',$context,'uninstall','argocd','-n','argocd','--wait','--timeout','5m')
if ($DestroyInfrastructure) {
    Push-Location "$ProjectRoot/terraform"
    try { Invoke-Checked terraform @('destroy') } finally { Pop-Location }
}
Write-Host 'Application storage and ingress removed. Save terraform destroy evidence and inspect AWS for remaining resources.'
