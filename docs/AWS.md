# Optional real AWS deployment

Local Kind is a real Kubernetes demonstration. Terraform mock-provider tests validate configuration and assertions without calling AWS; they are not VPC/EKS provisioning evidence.

## Before provisioning

1. Confirm whether the instructor accepts mocking. If not, schedule a short deployment/evaluation window.
2. Check remaining credit balance, eligible services, and expiry in AWS Billing. Estimate EKS, two EC2 workers, NAT/data transfer, EBS, public IPv4, and the ingress NLB using the AWS Pricing Calculator. Configure a billing alert. No credit coverage or zero-cost deployment is assumed.
3. Authenticate AWS CLI using your permitted AWS profile/SSO. Never commit keys, kubeconfig, `.tfvars` containing sensitive values, or state.
4. Check regional support with `aws eks describe-cluster-versions --region ap-south-1`. The selected version is 1.35 with STANDARD upgrade policy. Verify account quotas for EKS, EC2, VPC, EIP, and NAT.
5. Use the same AWS identity for plan/apply/bootstrap, or arrange EKS access explicitly. Preserve the local Terraform state securely; it is necessary to destroy the resources.
6. The optional `deploy-aws` workflow job uses a Terraform-created GitHub OIDC role. It is gated by repository variables and was skipped in the saved successful Actions run; the real AWS deployment was performed and verified separately.

Official references: [EKS version lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html), [EBS CSI](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html), [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/), [Pricing Calculator](https://calculator.aws/).

## Provision and bootstrap

```powershell
$env:AWS_PROFILE = 'stockpilot-tf'
$env:AWS_REGION = 'ap-south-1'
aws sts get-caller-identity
Set-Location terraform
Copy-Item terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars, including github_repository if using cloud CI deployment.
terraform init
terraform validate
terraform plan -out=capstone.tfplan
terraform show capstone.tfplan
# Review the plan and confirm names, region, CIDR, and expected billable resources.
# Only then run: terraform apply capstone.tfplan
Set-Location ..
.\scripts\bootstrap-aws.ps1
```

Before running Terraform, select the verified named AWS profile (`$env:AWS_PROFILE = 'stockpilot-tf'` in PowerShell or `export AWS_PROFILE=stockpilot-tf` in Git Bash) and region `ap-south-1`. For manual deployment, set `api_allowed_cidrs = ["YOUR_PUBLIC_IPV4/32"]` in `terraform.tfvars`, replacing the placeholder with your current public IPv4 address. Do not leave the default `0.0.0.0/0` open to every source IP. GitHub-hosted runners need reachable API access; use manual AWS deployment for this classroom demo unless wider control-plane access has been deliberately reviewed. Private worker subnets reach image registries through the single NAT gateway. This is a short-lived classroom architecture, not a highly available production database or network.

`scripts/bootstrap-aws.ps1` installs the AWS Load Balancer Controller using its Terraform-provisioned IRSA role, Traefik with an internet-facing NLB Service, Metrics Server, the gp3 StorageClass, monitoring, generated database/Grafana Secrets, and Argo CD. It then applies `argocd/stockpilot-project.yaml` and `argocd/stockpilot-application.yaml`; Argo CD renders the Helm chart from the public repository and deploys it to `stockpilot`. The AppProject limits the source repository and destination namespace. `values-gitops.yaml` pins both public images to the full SHA of a successful CI run. The Argo CD Helm chart is pinned to 10.10.3 in `scripts/bootstrap-argocd.ps1`. The controller policy is vendored from upstream release v3.6.0. This project was provisioned on AWS and the Argo CD application, EKS workloads, ingress, and persistent volume were verified. Capture the final destroy evidence before the deadline and verify no billable resources remain.

## Deploy application images

First publish both GHCR packages and make them public. The AWS application is managed by Argo CD; do not install the `stockpilot` chart separately with Helm while Argo CD owns that release. For a manual image promotion, update both tags in `helm/stockpilot/values-gitops.yaml` to the same full commit SHA from a successful build, then commit and push that file. Argo CD auto-syncs the tracked `main` revision. Check the application:

```powershell
kubectl --context stockpilot-aws -n argocd wait application/stockpilot `
  --for=jsonpath={.status.sync.status}=Synced --timeout=15m
kubectl --context stockpilot-aws -n argocd wait application/stockpilot `
  --for=jsonpath={.status.health.status}=Healthy --timeout=15m
kubectl --context stockpilot-aws -n argocd get application stockpilot
kubectl --context stockpilot-aws get svc traefik -n ingress
```

The AWS application Ingress omits a hostname, so access the NLB DNS address directly. Demonstrate only fictional data: this v1 application has no login or public TLS setup.

The configured `deploy-aws` job can run after a successful main-branch test, image build, Trivy scan, and GHCR publication when `DEPLOY_AWS=true`. It uses GitHub OIDC to assume the Terraform-created role, updates the Argo CD Application with the exact published image SHA, and waits for sync, health, and `/api/version`. In the saved successful Actions run, the job was skipped; do not present it as a completed automatic deployment. The AWS deployment and Argo CD status were verified separately.

Enable the repository variable only after the AWS cluster and Argo CD Application are healthy. In GitHub, open **Settings → Secrets and variables → Actions → Variables → New repository variable**, set name `DEPLOY_AWS`, value `true`, and save. Or, with authenticated GitHub CLI:

```powershell
gh variable set DEPLOY_AWS --body true --repo piyush6805/devops_capstone_project
```

The job requires the correct repository variables, AWS OIDC trust, and EKS access to be configured. The saved run's skipped status means that end-to-end Actions-to-AWS behavior is not demonstrated by the screenshot.

For the Argo CD UI, keep it private and use a local port-forward:

```powershell
kubectl --context stockpilot-aws -n argocd port-forward svc/argocd-server 8080:443
# In another terminal, get the initial admin password locally (do not screenshot it):
$encoded = kubectl --context stockpilot-aws -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}'
[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))
```

Open `https://localhost:8080`, sign in as `admin`, and capture the StockPilot application showing `Synced` and `Healthy`. Do not expose Argo CD with a public LoadBalancer for this demo.

## Capture evidence and destroy

Capture real plan output, AWS Console VPC/EKS screens, application ingress, Running pods, Helm releases, and monitoring before teardown. Set `DEPLOY_AWS=false` (or remove the variable) and let any active Actions run finish before deleting resources.

```powershell
.\scripts\cleanup-aws.ps1 -DestroyInfrastructure
```

This removes the Argo CD Application and its managed workloads/PVCs, waits for EBS volumes to disappear, removes Traefik while the AWS Load Balancer Controller can process the NLB finalizer, and then removes monitoring, controller, and Argo CD releases. `terraform destroy` asks for its normal confirmation. Save completion output and inspect AWS for remaining load balancers, EBS volumes, EIPs, NAT gateways, and instances. If cleanup fails, repair it before destroying the cluster; losing its controllers can leave AWS resources behind.
