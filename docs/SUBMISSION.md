# Submission checklist — 100-point rubric

Use the teacher's preserved `docs/reference/GRADING.md` as the authoritative rubric. Collect screenshots or recording evidence of actual runs; do not use mocked output for real-cloud criteria.

| Module | Points | Implemented source | Evidence to submit |
|---|---:|---|---|
| M1 Application | 10 | React screens, FastAPI CRUD/stock API, PostgreSQL Alembic migration | Browser application and API CRUD |
| M2 Tests | 10 | 28 PostgreSQL backend cases, isolated fixtures, pytest.ini | Passing `pytest -v` output |
| M3 Git | 5 | Independent Git repository, meaningful commits, .gitignore | Public repository URL and at least 10 commits |
| M4 Docker | 10 | Both non-root Dockerfiles, multi-stage frontend, healthy Compose | Build/start output and localhost:3000 |
| M5 CI/CD | 15 | Main/PR workflow, tests before images, GHCR SHA tags | Green Actions URL and both package pages |
| M6 Security | 5 | Both Trivy scans, fail-before-publish gate, saved reports | Scan output and a short CVE/clean-result explanation |
| M7 Terraform | 15 | VPC/EKS/node group/storage IAM, examples, mock tests | Real plan, VPC/EKS Console, destroy completion — or instructor-approved alternative |
| M8 Kubernetes | 15 | Namespace, Helm chart, replicas, Services, Ingress | Running pods, Services, Helm list, ingress browser |
| M9 Observability | 10 | /metrics, ServiceMonitor, monitoring chart, six dashboard panels | Metrics output, Prometheus target UP, populated Grafana |
| M10 Presentation | 5 | README, demo runbook, automatic deployment watcher | Commit-to-deployment live demonstration/recording |

Additional presentation evidence: HPA scaling and recovery, image/Service troubleshooting, data persistence after pod restart, and application rollback.

Run `scripts/collect-evidence.ps1` to save local command output. Browser smoke checks save desktop/mobile PNGs under `artifacts/`; Trivy reports and Terraform mock output also go there. Capture remote GitHub/AWS screenshots manually after those actions actually run. `scripts/package-submission.ps1` packages committed source and the local artifact directory separately, excluding ignored credentials and dependency caches.

Suggested Trivy explanation: “Trivy inspected OS packages and Python dependencies in the backend runtime and OS packages in the Nginx frontend runtime. The HIGH/CRITICAL gate checks both reports before publishing either image. A clean result means no matching HIGH/CRITICAL vulnerabilities were identified in that database snapshot; it does not establish that the application is free of security issues.”

The original backend scan identified vulnerable legacy Starlette and build-tool dependencies. The implementation upgrades Starlette, uses direct Prometheus ASGI instrumentation, chooses an Alpine runtime, and removes unused packaging tooling. Keep the actual scan reports supporting the final result.
