# StockPilot

[![StockPilot CI/CD](https://github.com/piyush6805/devops_capstone_project/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/piyush6805/devops_capstone_project/actions/workflows/ci-cd.yml)

[Public source](https://github.com/piyush6805/devops_capstone_project) · [Verified pipeline run](https://github.com/piyush6805/devops_capstone_project/actions/runs/38291481396) · [Backend image](https://github.com/users/piyush6805/packages/container/package/devops_capstone_project-backend) · [Frontend image](https://github.com/users/piyush6805/packages/container/package/devops_capstone_project-frontend)

An inventory dashboard with an auditable stock ledger, built for the DevOps capstone. Manage products, receive or issue stock, track adjustments, and spot low-stock items. Prices use INR. The demonstration uses fictional data and has no authentication.

The original instructor material remains under `docs/reference/`. StockPilot has its own application domain, data model, UI, test suite, and delivery configuration.

## Architecture

```mermaid
flowchart LR
  Git[Commit to main] --> CI[GitHub Actions: tests and validation]
  CI --> Build[Build two images]
  Build --> Scan[Trivy HIGH / CRITICAL gate]
  Scan --> Registry[GHCR: commit SHA tags]
  Registry --> Watch[Local PowerShell watcher]
  Registry --> Deploy[Optional OIDC-gated deploy job]
  Deploy --> Argo[Argo CD: AWS GitOps]
  Watch --> Helm[Helm deployment]
  Browser --> Ingress[Traefik Ingress]
  Ingress --> UI[React / non-root Nginx]
  Ingress --> API[FastAPI / non-root Python]
  API --> DB[(PostgreSQL + stock ledger)]
  API --> Prom[Prometheus]
  Prom --> Grafana[Grafana dashboards]
  Helm --> UI
  Helm --> API
  Argo --> Helm
```

Docker Compose is the quickest way to run the app. A separate Kind cluster demonstrates Kubernetes locally. Terraform provisions the AWS VPC/EKS path; a real EKS deployment and Argo CD sync were verified for this capstone. Treat AWS as temporary demo infrastructure and destroy it after the final evidence and recording are saved.

## Screenshot evidence

The screenshots include local application previews and captures from the AWS EKS deployment. Each image is labeled by the system it actually shows; local demo inventory is fictional seed data. See [Screenshot.md](Screenshot.md) for the evidence index and `docs/screenshots/` for the PNGs. Do not use the AWS identity image or the in-progress Terraform apply image as proof of a successful plan or deployment.

![StockPilot dashboard from a local browser verification run](docs/screenshots/local-dashboard-smoke.png)

![Grafana application and autoscaling panels from a local verification run](docs/screenshots/local-grafana-smoke.png)

## Start on Windows

Requirements: Docker Desktop **running with Linux containers**. Run these commands from the project root in PowerShell:

```powershell
docker compose up --build -d --wait
docker compose exec backend python -m app.seed
```

- Application: [localhost:3000](http://localhost:3000)
- API documentation: [localhost:8000/docs](http://localhost:8000/docs)
- Liveness / readiness / metrics: `localhost:8000/health`, `/ready`, `/metrics`
- Host PostgreSQL port: **15432**; container port: 5432

Compose has a development-only password default. Copy `.env.example` to `.env` to override it before the first database initialization. Changing a password after creating a database volume does not rotate its database user. Generated Kubernetes credentials are separate.

```powershell
docker compose down             # Stop; retain database
# docker compose down --volumes # Explicitly erase the local demo database
```

## Run the checks

Install Node.js 22.12+ for host frontend checks; Python on the host is optional. Backend tests use Python 3.12 and a dedicated PostgreSQL database inside containers.

```powershell
.\scripts\test.ps1
.\scripts\scan-images.ps1
helm lint helm/stockpilot
Set-Location terraform
terraform init -backend=false
terraform validate
terraform test
Set-Location ..
```

There are 28 backend test cases, including competing withdrawals, and seven frontend component tests. Test configuration refuses a PostgreSQL database unless its name ends in `_test`. Alembic creates the test schema; tests never use `create_all`.

For an actual browser CRUD and responsive-layout check:

```powershell
Set-Location frontend
npm ci
npx playwright install chromium
npm run test:e2e
Set-Location ..
```

Set `APP_URL` to `http://stockpilot.localhost:8080` to test Kubernetes instead. Browser screenshots and scan reports go into the ignored `artifacts/` folder.

## Deploy to local Kubernetes

Requirements: Kind, kubectl, and Helm on PATH. This creates **only** the `stockpilot` Kind cluster, with context `kind-stockpilot`; scripts explicitly target it.

```powershell
.\scripts\bootstrap-local.ps1
.\scripts\deploy-local.ps1 -Commit (git rev-parse HEAD).Trim()
kubectl --context kind-stockpilot exec -n stockpilot deployment/stockpilot-backend -- python -m app.seed
```

Open [stockpilot.localhost:8080](http://stockpilot.localhost:8080). The Kind mapping binds only to localhost. If your browser does not resolve this hostname, add `127.0.0.1 stockpilot.localhost` to the Windows hosts file, or verify routing with:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/version -Headers @{Host='stockpilot.localhost'}
kubectl --context kind-stockpilot get pods,svc,ingress,hpa,pvc -n stockpilot
helm --kube-context kind-stockpilot list -A
```

The Helm release has two frontend replicas, a backend HPA with minimum two replicas, PostgreSQL with a PVC, and one migration Job per image tag. Backend init containers wait for the migration revision. Use immutable SHA tags for updates. For repeated local-tag development, rebuild images and explicitly restart Deployments; Kubernetes does not detect a changed image behind the same tag.

Migration Jobs are regular release resources, so they can run alongside the database StatefulSet during first installation. They do not depend on a post-install hook that would deadlock Helm readiness checks. Rollback changes application images; it does not reverse database migrations. Future schema changes must remain compatible with the previous release.

## Prometheus, Grafana, and HPA

Run each port-forward in its own terminal:

```powershell
kubectl --context kind-stockpilot -n monitoring port-forward svc/monitoring-kube-prometheus-prometheus 9090:9090
kubectl --context kind-stockpilot -n monitoring port-forward svc/monitoring-grafana 3001:80
```

Open [Prometheus](http://localhost:9090/targets) and [Grafana](http://localhost:3001). Grafana user is `admin`; retrieve its generated password locally:

```powershell
$encoded = kubectl --context kind-stockpilot -n monitoring get secret stockpilot-grafana -o jsonpath='{.data.admin-password}'
[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))
```

Open the **StockPilot · application and autoscaling** dashboard. Panels show request rate, p95 latency, 5xx errors, CPU, HPA desired replicas, and available replicas. The application ServiceMonitor is enabled only after monitoring CRDs exist.

Generate real application traffic and observe scaling:

```powershell
py scripts/load-test.py --seconds 120 --workers 40
# In another terminal:
kubectl --context kind-stockpilot get hpa -n stockpilot --watch
```

Metrics Server supplies HPA CPU measurements; Prometheus supplies application dashboards. Local CPU requests are 25m to make scaling demonstrable. Allow several minutes for scaling down after load stops.

## GitHub CI and automatic local delivery

Install GitHub CLI (`winget install --id GitHub.cli --exact`) if it is not available. On the prepared workstation a portable copy is also detected from `.local/tools`.

```powershell
.\scripts\github-login.ps1
.\scripts\publish-github.ps1 -RepositoryName devops_capstone_project
```

The workflow tests PostgreSQL APIs, checks Python code, tests/builds the frontend, validates Helm and Terraform, builds both runtime images, and scans **both** with Trivy. Both scan outcomes must succeed before either image is published. Pull requests run validation without publishing images or accessing your cluster.

Both published GHCR packages were verified to allow anonymous pulls. When reproducing this setup in another repository, verify package visibility and change it to **Public** if necessary. Names are `ghcr.io/OWNER/REPOSITORY-backend` and `ghcr.io/OWNER/REPOSITORY-frontend`. Each image uses the full commit SHA, never `latest`.

The workflow also defines a gated `deploy-aws` job that uses GitHub OIDC to update the Argo CD Application after image publication. In the saved successful run, this job was skipped, so the captured AWS deployment and Argo CD sync are separate evidence; the video must not call that run an end-to-end automatic AWS deployment.

```powershell
.\scripts\start-watcher.ps1
# .\scripts\stop-watcher.ps1
# Foreground mode for watching the demo output:
# .\scripts\watch-deploy.ps1 -Repository piyush6805/devops_capstone_project
```

The start script runs the watcher in the background while your computer and Docker are running; its logs and PID are saved under `.local/`. Foreground mode requires keeping its terminal open. It checks successful main runs every 60 seconds, requires their SHA to match current main HEAD, downloads the exact chart artifact, verifies repository/image metadata, deploys with bounded Helm waits, and checks `/api/version`. It saves state only after successful deployment. Failed or older runs cannot replace the deployed release. The watcher requires GitHub authentication and runs locally; no kubeconfig is uploaded to GitHub. It does not install a Windows startup task; run the start script again after reboot.

## AWS path and grading

See [AWS runbook](docs/AWS.md). Terraform creates a VPC, two public/private subnet pairs, one NAT gateway, an EKS cluster, two managed worker nodes, EBS CSI permissions, and AWS Load Balancer Controller permissions. The configured optional CI deployment job uses GitHub OIDC and was skipped in the saved Actions run.

Terraform validation and mock-provider tests do not create AWS resources. The real AWS VPC/EKS deployment and Argo CD sync were performed; some required screenshots (a Terraform plan, VPC/EKS Console, Argo CD status, filtered Prometheus target, and teardown) are still missing from the screenshot folder. Never present mock output or an in-progress apply as a completed plan. See [AWS and Argo CD deployment](docs/AWS.md).

## Submission and presentation

The attached submission note requires a `demo/` folder with the slide deck and a **mandatory MP4 video**, then submission of the public GitHub repository link through the provided form. Keep master copies at the repository root as requested, and keep matching submission copies in `demo/`. The video order is slides, codebase, CI/CD, Terraform plan and AWS VPC/EKS, Argo CD, healthy Kubernetes, Prometheus StockPilot target `UP`, and Grafana. The requested evidence-only recording uses saved captures and does not trigger a new run; clearly state that the saved CI run skipped AWS deployment and that several required screenshots are missing. The operator guide and recording script are kept in the parent `Devops_capstone` folder. The supplied submission brief lists the deadline as **19 October 2026 at 11:59 PM IST**.

- [Rubric checklist and evidence map](docs/SUBMISSION.md)
- [Screenshot evidence](Screenshot.md)
- Operator guide and video notes: kept locally in the parent `Devops_capstone` folder and intentionally excluded from this submission repo.
- [API contract](docs/API.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Verification record](docs/VERIFICATION.md)

Submission package checklist:

- [ ] `demo/StockPilot.pptx` (or a PDF slide deck)
- [ ] `demo/StockPilot-Demo.mp4`
- [ ] Final screenshot evidence in `Screenshot.md` and `docs/screenshots/`
- [ ] Successful AWS destroy evidence and no leftover billable resources
- [ ] Submit the public repository URL at <https://forms.gle/XWAP1vAumDJgAPM1A>

```powershell
.\scripts\collect-evidence.ps1
.\scripts\package-submission.ps1
```

Keep credentials, test databases, dependency caches, and Terraform state out of the submission. Screenshots are stored separately from source control. Use meaningful commits as work progresses; do not fabricate commit history or pipeline results.

To stop the local application while retaining Compose data:

```powershell
.\scripts\cleanup-local.ps1
# .\scripts\cleanup-local.ps1 -DeleteCluster # Also erases the dedicated Kind cluster and its demo data
```
