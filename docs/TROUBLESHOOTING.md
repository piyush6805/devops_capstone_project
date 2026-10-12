# Troubleshooting and recovery

## Docker cannot connect

Start Docker Desktop, select Linux containers, and wait for `docker info` to work. Port 15432 avoids a blocked/reserved Windows 5432 port. If another mapped port is unavailable, inspect `Get-NetTCPConnection` and `netsh interface ipv4 show excludedportrange protocol=tcp` before changing Compose mappings.

## Application readiness or migration failure

```powershell
kubectl --context kind-stockpilot get pods,jobs,pvc -n stockpilot
kubectl --context kind-stockpilot logs -n stockpilot job/RELEASE-MIGRATION-JOB
kubectl --context kind-stockpilot logs -n stockpilot stockpilot-postgres-0
kubectl --context kind-stockpilot describe pod -n stockpilot POD_NAME
```

The database must have its Secret, bound PVC, and healthy Service. Migration Jobs may retry while PostgreSQL initializes; backend init containers wait for the expected schema. Preserve the Secret when the PVC is retained. Changing the Secret alone does not rotate an existing PostgreSQL user's password.

## Isolated failure exercises

```powershell
kubectl --context kind-stockpilot apply -f troubleshooting/broken-image.yaml
kubectl --context kind-stockpilot apply -f troubleshooting/broken-service.yaml
kubectl --context kind-stockpilot get pods,svc -n stockpilot-troubleshooting
kubectl --context kind-stockpilot describe deployment broken-image -n stockpilot-troubleshooting
kubectl --context kind-stockpilot get events -n stockpilot-troubleshooting --sort-by=.lastTimestamp
kubectl --context kind-stockpilot get endpointslices -n stockpilot-troubleshooting
```

Repair with the exact deployed backend image (which is already loaded into Kind), then correct the Service selector:

```powershell
$image = kubectl --context kind-stockpilot -n stockpilot get deployment stockpilot-backend -o jsonpath='{.spec.template.spec.containers[0].image}'
kubectl --context kind-stockpilot -n stockpilot-troubleshooting set image deployment/broken-image backend=$image
kubectl --context kind-stockpilot -n stockpilot-troubleshooting patch deployment broken-image --type strategic -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","imagePullPolicy":"IfNotPresent"}]}}}}'
kubectl --context kind-stockpilot -n stockpilot-troubleshooting patch service broken-service --type merge -p '{"spec":{"selector":{"app":"broken-image"}}}'
kubectl --context kind-stockpilot get endpointslices -n stockpilot-troubleshooting
kubectl --context kind-stockpilot delete -f troubleshooting/broken-image.yaml -f troubleshooting/broken-service.yaml
```

The exercise backend can answer `/health` without a database; `/ready` is not expected to succeed in this isolated namespace. ImagePullBackOff is diagnosed with pod events; a wrong Service selector produces no matching endpoints.

## HPA is unknown or does not scale

Verify `kubectl --context kind-stockpilot top pods -n stockpilot`, inspect HPA events, confirm CPU requests, and use concurrent application traffic rather than liveness requests. CPU metrics are sampled; scaling and scale-down are not instantaneous.

## Grafana is empty

Check application ServiceMonitor/Service labels, monitoring CRDs, Prometheus targets, and the dashboard ConfigMap label. Generate traffic and wait for two or more scrapes. The Prometheus datasource UID is `prometheus`. No traffic yields empty request-rate/latency series initially.

## Failed delivery or rollback

The watcher never advances its saved state on failure. Check GitHub authentication, artifact retention, public package visibility, image tags, pod events, migration logs, and Helm history. It skips runs whose SHA is no longer main HEAD. Do not delete `.local` deployment state while the watcher is running.

Stop the watcher before intentional rollback:

```powershell
helm --kube-context kind-stockpilot history stockpilot -n stockpilot
helm --kube-context kind-stockpilot rollback stockpilot PREVIOUS_REVISION -n stockpilot --wait --timeout 10m
Invoke-RestMethod http://127.0.0.1:8080/api/version -Headers @{Host='stockpilot.localhost'}
```

Only backward-compatible schema changes permit application rollback; Alembic downgrade is never part of automated rollback.
