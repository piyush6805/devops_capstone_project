. "$PSScriptRoot/common.ps1"
$output = "$ProjectRoot/.local/submission"
New-Item -ItemType Directory -Force -Path $output | Out-Null
Push-Location $ProjectRoot
try {
    Invoke-Checked git @('archive','--format=zip',"--output=$output/stockpilot-source.zip",'HEAD')
    if (Test-Path -LiteralPath "$ProjectRoot/artifacts") {
        Compress-Archive -Path "$ProjectRoot/artifacts/*" -DestinationPath "$output/stockpilot-evidence.zip" -Force
    }
    Write-Host "Source/evidence archives saved under $output. Include your GitHub run URL and instructor-required AWS evidence."
} finally { Pop-Location }
