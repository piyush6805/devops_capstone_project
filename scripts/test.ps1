. "$PSScriptRoot/common.ps1"
Push-Location $ProjectRoot
try {
    Invoke-Checked docker @('compose','-f','compose.test.yml','up','--build','--abort-on-container-exit','--exit-code-from','tests')
    Push-Location frontend
    try {
        Invoke-Checked npm.cmd @('ci')
        Invoke-Checked npm.cmd @('test')
        Invoke-Checked npm.cmd @('run','build')
    } finally { Pop-Location }
} finally {
    & docker compose -f compose.test.yml down --volumes
    Pop-Location
}
