# Optional real AWS deployment

Local Kind is a real Kubernetes demonstration. Terraform mock-provider tests validate configuration and assertions without calling AWS; they are not VPC/EKS provisioning evidence.

## Before provisioning

1. Confirm whether the instructor accepts mocking. If not, schedule a short deployment/evaluation window.
2. Check remaining credit balance, eligible services, and expiry in AWS Billing. Estimate EKS, two EC2 workers, NAT/data transfer, EBS, public IPv4, and the ingress NLB using the AWS Pricing Calculator. Configure a billing alert. No credit coverage or zero-cost deployment is assumed.
3. Authenticate AWS CLI using your permitted AWS profile/SSO. Never commit keys, kubeconfig, `.tfvars` containing sensitive values, or state.
4. Check regional support with `aws eks describe-cluster-versions --region ap-south-1`. The selected version is 1.35 with STANDARD upgrade policy. Verify account quotas for EKS, EC2, VPC, EIP, and NAT.
5. Use the same AWS identity for plan/apply/bootstrap, or arrange EKS access explicitly. Preserve the local Terraform state securely; it is necessary to destroy the resources.

Official references: [EKS version lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html), [EBS CSI](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html), [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/), [Pricing Calculator](https://calculator.aws/).

## Provision and bootstrap

```powershell
aws sts get-caller-identity
Set-Location terraform
Copy-Item terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars, including github_repository if using cloud CI deployment.
terraform init
terraform validate
terraform plan -out=capstone.tfplan
terraform apply capstone.tfplan
Set-Location ..
.\scripts\bootstrap-aws.ps1
```

`api_allowed_cidrs` can restrict the cluster's public API to your IP for manual deployment. GitHub-hosted runners need reachable API access; the default broad CIDR still requires IAM/Kubernetes authorization. Private worker subnets reach image registries through the single NAT gateway. This is a short-lived classroom architecture, not a highly available production database or network.

Bootstrap installs the AWS Load Balancer Controller using its Terraform-provisioned IRSA role, Traefik with an internet-facing NLB Service, Metrics Server, the gp3 StorageClass, monitoring, and generated database/Grafana Secrets. The controller policy is vendored from upstream release v3.6.0. The AWS path has been checked with Terraform validation/mocks; actual provisioning remains a separate check.

## Deploy application images

First publish both GHCR packages and make them public. For manual deployment:

```powershell
$repo = 'ghcr.io/YOUR_OWNER/YOUR_REPOSITORY'
$sha = 'FULL_SUCCESSFUL_COMMIT_SHA'
helm --kube-context stockpilot-aws upgrade --install stockpilot helm/stockpilot -n stockpilot `
  -f helm/stockpilot/values-aws.yaml `
  --set-string backend.image="$repo-backend" --set-string frontend.image="$repo-frontend" `
  --set-string backend.tag=$sha --set-string frontend.tag=$sha `
  --atomic --wait --wait-for-jobs --timeout 10m
kubectl --context stockpilot-aws get svc traefik -n ingress
```

The AWS application Ingress omits a hostname, so access the NLB DNS address directly. Demonstrate only fictional data: this v1 application has no login or public TLS setup.

For automatic AWS deployment, set repository variables:

- `AWS_DEPLOY_ROLE_ARN`: Terraform `github_deploy_role_arn` output.
- `EKS_CLUSTER_NAME`: `stockpilot-eks`.
- `DEPLOY_AWS`: `true`, only after infrastructure and bootstrap are ready.

OIDC trust accepts only `repo:OWNER/REPOSITORY:ref:refs/heads/main`. No long-lived AWS key is stored in GitHub. If the account already has a GitHub OIDC provider, set `existing_github_oidc_provider_arn` to reuse it.

## Capture evidence and destroy

Capture real plan output, AWS Console VPC/EKS screens, application ingress, Running pods, Helm releases, and monitoring before teardown. Disable `DEPLOY_AWS` and stop any delivery watcher before deleting resources.

```powershell
.\scripts\cleanup-aws.ps1 -DestroyInfrastructure
```

This removes application workloads/PVCs, waits for their EBS volumes to disappear, removes Traefik while the AWS Load Balancer Controller can process the NLB finalizer, and then removes monitoring/controller releases. `terraform destroy` asks for its normal confirmation. Save completion output and inspect AWS for remaining load balancers, EBS volumes, EIPs, NAT gateways, and instances. If cleanup fails, repair it before destroying the cluster; losing its controllers can leave AWS resources behind.
