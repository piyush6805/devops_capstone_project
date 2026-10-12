Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$localGh = Get-ChildItem "$ProjectRoot/.local/tools" -Recurse -Filter gh.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if ($localGh) { $env:PATH = "$($localGh.DirectoryName);$env:PATH" }

function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE" }
}

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "Install $Name and add it to PATH first." }
}

function New-HexPassword {
    $bytes = New-Object byte[] 24
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

function Wait-AppVersion([string]$Commit) {
    $deadline = (Get-Date).AddSeconds(60)
    do {
        try {
            $version = Invoke-RestMethod 'http://127.0.0.1:8080/api/version' -Headers @{Host='stockpilot.localhost'} -TimeoutSec 5
            if ($version.commit -eq $Commit) { return $version }
        } catch { Write-Verbose 'Waiting for ingress endpoints to converge after rollout.' }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw "Ingress did not serve expected commit $Commit within 60 seconds."
}

function Ensure-DatabaseSecret([string]$Context) {
    & kubectl --context $Context -n stockpilot get secret stockpilot-db -o name 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { return }
    $password = New-HexPassword
    $secret = @{apiVersion='v1';kind='Secret';metadata=@{name='stockpilot-db';namespace='stockpilot'};type='Opaque';stringData=@{
        POSTGRES_USER='stockpilot';POSTGRES_DB='stockpilot';POSTGRES_PASSWORD=$password
        DATABASE_URL="postgresql+psycopg://stockpilot:$password@stockpilot-postgres:5432/stockpilot"
    }} | ConvertTo-Json -Depth 6
    $secret | & kubectl --context $Context apply -f - | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Database secret creation failed' }
}
