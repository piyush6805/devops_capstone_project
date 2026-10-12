# Verification record

Verified on 12 October 2026 on the prepared Windows workstation. Outputs and PNGs are stored locally under the ignored `artifacts/` folder. Results describe actual checks, not predicted rubric marks.

| Check | Result |
|---|---|
| PostgreSQL API tests | 28 passed using Python 3.12 containers and a dedicated test database |
| Frontend component tests | 7 passed; production build succeeds |
| Browser acceptance | Product creation, receipt, issue, archive/history retention, desktop and mobile checks passed |
| Compose | Three healthy services; frontend UID 101 and backend UID 10001 |
| Runtime security | Both images returned zero HIGH/CRITICAL findings in the captured Trivy snapshot |
| Terraform | Init and validation pass; all three mock-provider tests pass; no AWS provisioning performed |
| Helm / Kind | Application deployed to kind-stockpilot; migration Job completes; frontend has two replicas and backend HPA minimum is two |
| Persistence | Dashboard values unchanged after replacing the PostgreSQL pod |
| Autoscaling | HPA scaled to six under real API traffic; Metrics Server and HPA events verified |
| Load without failure injection | 6,746 successful requests, zero errors during a 30-second, 12-worker run |
| Prometheus | All active backend targets UP; live request-rate and latency series present |
| Grafana | Six populated request/latency/error/CPU/replica panels; screenshot captured |
| Troubleshooting | Bad image pull and empty Service endpoints captured; image/selector repaired and isolated resources removed |
| Rollback | Rolled back to the prior application commit, restored the current commit, and confirmed schema revision 0001_inventory remained unchanged |
| GitHub / GHCR / watcher | Implemented; live publication and end-to-end watcher verification require GitHub browser authentication |
| Real AWS | Prepared only; provisioning/evaluation/destroy require the optional AWS execution path |

A 120-second load run overlapped the intentional PostgreSQL pod replacement and recorded 18,962 successes and 281 failures. That run demonstrates fault injection/recovery; it is not the zero-error acceptance run. The subsequent stable run above passed.

Testing uncovered and corrected a Helm 4 ownership conflict between Helm's backend replica count and the HPA. Backend replicas are now owned by the HPA when enabled, so later upgrades preserve its scaling control. Migration startup now waits for database access, and unused packaging tooling was removed from the runtime after actual Trivy findings.

Version verification polls for up to 60 seconds after Helm completes, allowing Ingress endpoints to converge before advancing watcher state. This handles the brief gateway error observed during the rollback rehearsal.

GitHub login is a user interaction; no green Actions URL or GHCR publication is claimed before it completes. Mock Terraform tests do not substitute for the instructor's real AWS evidence unless explicitly accepted.
