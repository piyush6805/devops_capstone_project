. "$PSScriptRoot/common.ps1"
New-Item -ItemType Directory -Force -Path "$ProjectRoot/artifacts" | Out-Null
$failed = $false
foreach ($component in @('backend','frontend')) {
    & docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v stockpilot-trivy-cache:/root/.cache -v "${ProjectRoot}/artifacts:/reports" aquasec/trivy:latest image --quiet --scanners vuln --severity HIGH,CRITICAL --exit-code 1 --format json --output "/reports/trivy-$component.json" "stockpilot-${component}:local"
    if ($LASTEXITCODE -ne 0) { $failed = $true }
    Write-Host "$component report: artifacts/trivy-$component.json"
}
if ($failed) { throw 'Image security gate failed. Inspect both saved reports; promotion must stop.' }
