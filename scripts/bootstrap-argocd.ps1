param([string]$ClusterContext = 'stockpilot-aws')
. "$PSScriptRoot/common.ps1"
foreach ($tool in @('helm','kubectl')) { Require-Command $tool }
Invoke-Checked kubectl @('--context',$ClusterContext,'get','nodes')
Invoke-Checked helm @('repo','add','argoproj','https://argoproj.github.io/argo-helm','--force-update')
Invoke-Checked helm @('repo','update','argoproj')
Invoke-Checked helm @('--kube-context',$ClusterContext,'upgrade','--install','argocd','argoproj/argo-cd',
    '--version','10.10.3','--namespace','argocd','--create-namespace','--wait','--timeout','10m')
Invoke-Checked kubectl @('--context',$ClusterContext,'apply','-f',"$ProjectRoot/argocd/stockpilot-project.yaml")
Invoke-Checked kubectl @('--context',$ClusterContext,'apply','-f',"$ProjectRoot/argocd/stockpilot-application.yaml")
Invoke-Checked kubectl @('--context',$ClusterContext,'--namespace','argocd','wait','application/stockpilot',
    '--for=jsonpath={.status.sync.status}=Synced','--timeout=15m')
Invoke-Checked kubectl @('--context',$ClusterContext,'--namespace','argocd','wait','application/stockpilot',
    '--for=jsonpath={.status.health.status}=Healthy','--timeout=15m')
Write-Host 'Argo CD is managing StockPilot from the pinned AWS Helm values.'
