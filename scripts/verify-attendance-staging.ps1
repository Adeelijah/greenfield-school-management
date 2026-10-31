param([switch]$ProvisionLogin)
$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
if (-not (Test-Path (Join-Path $root 'node_modules/postgres'))) { throw 'Run from the repository root with existing dependencies.' }
$certificate = Join-Path $root 'recovery-artifacts/greenfield-staging-ca.crt'
if (-not (Test-Path $certificate)) { throw 'The existing Greenfield staging CA certificate is required.' }
& node .\scripts\verify-offline.mjs
if ($LASTEXITCODE -ne 0) { throw 'Offline checks failed; no credentials requested.' }
Write-Host 'Target: Greenfield STAGING hweoqkbgmzycyznrbvng. This does not save attendance records.'
if ($ProvisionLogin) { Write-Host 'ProvisionLogin sets the dedicated greenfield_attendance_app password only. Retain this password locally.' }
$previousOutputEncoding = $OutputEncoding
try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $secure = Read-Host 'Dedicated greenfield_attendance_app password (20+ characters; new only with ProvisionLogin)' -AsSecureString
    $credential = [System.Net.NetworkCredential]::new('', $secure)
    $operatorPassword = ''
    if ($ProvisionLogin) {
        $operatorSecure = Read-Host 'Greenfield STAGING postgres database password (not your local disposable password)' -AsSecureString
        $operatorCredential = [System.Net.NetworkCredential]::new('', $operatorSecure)
        $operatorPassword = $operatorCredential.Password
    }
    $payload = @{project='hweoqkbgmzycyznrbvng';provision=[bool]$ProvisionLogin;password=$credential.Password;operatorPassword=$operatorPassword;certificate=$certificate} | ConvertTo-Json -Compress
    $payload | & node --experimental-strip-types .\scripts\attendance-staging-login.mjs --explicit-staging-input
    if ($LASTEXITCODE -ne 0) { throw 'Attendance staging check failed. Share the bounded FAIL line only. If provisioning passed, retain the configured password.' }
} finally {
    $OutputEncoding = $previousOutputEncoding
    Remove-Variable secure, credential, operatorSecure, operatorCredential, operatorPassword, payload -ErrorAction SilentlyContinue
}
