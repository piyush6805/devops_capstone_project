# Presentation walkthrough

Before starting: Docker/Kind running, application seeded, GitHub authenticated, GHCR packages public, watcher active, Prometheus/Grafana port-forwards running. Test your recording and keep the evidence folder available.

1. **Application:** show inventory value and low-stock alerts. Create a product, receive ten units, issue three, edit its details, and show the permanent movement ledger.
2. **API and database:** open Swagger on localhost:8000/docs. Explain GET/POST/PUT/DELETE, validation, and row locking. Show `products`, `movements`, and `alembic_version` using the database command below.
3. **Tests:** show the 28 passing backend tests, especially the concurrent-withdrawal result. Explain why tests use a dedicated database before image publication.
4. **Git/CI/CD:** make a small visible heading change, commit with a meaningful message, and push main. Show the GitHub Actions test, build, scan, and publication stages.
5. **Registry/deployment:** show both GHCR SHA tags. The local watcher downloads the matching chart and deploys it. Refresh the Kubernetes UI and confirm the changed heading and commit footer.
6. **Kubernetes:** show replicas, Services, Ingress routes, PVC, completed migration Job, and Helm history. Explain liveness versus readiness.
7. **Autoscaling:** run the bounded load generator. Watch HPA rise above two replicas. Explain CPU requests and Metrics Server, then show Grafana traffic/CPU/replica panels.
8. **Troubleshooting:** apply the isolated broken image and Service, inspect events/EndpointSlices, repair them, and delete the exercises. Commands are in TROUBLESHOOTING.md.
9. **Rollback:** show a previous release, roll back, verify the prior commit, then restore the current release. Stop the watcher during this deliberate rollback. Database migrations are not reversed.
10. **Terraform:** explain the real VPC/EKS code and the distinction between mocked checks and AWS provisioning. If AWS was required, show real provisioning and final destroy evidence.

```powershell
docker compose exec postgres psql -U stockpilot -d stockpilot -c 'SELECT sku, quantity FROM products; SELECT product_id, delta, kind FROM movements; SELECT * FROM alembic_version;'
git log --oneline -12
kubectl --context kind-stockpilot get pods,svc,ingress,hpa,pvc,jobs -n stockpilot
helm --kube-context kind-stockpilot history stockpilot -n stockpilot
```

Finish by identifying every submitted evidence file and explaining the cleanup process. No staged screenshot should be described as an actual successful pipeline run.
