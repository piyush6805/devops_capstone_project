. "$PSScriptRoot/common.ps1"
Require-Command gh
Invoke-Checked gh @('auth','login','--hostname','github.com','--git-protocol','https','--web')
Invoke-Checked gh @('auth','setup-git')
