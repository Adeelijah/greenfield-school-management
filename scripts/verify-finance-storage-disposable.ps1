$ErrorActionPreference = 'Stop'
if (-not (Test-Path '.\node_modules\postgres')) { throw 'Run from the Greenfield repository root with existing dependencies.' }
& node .\scripts\verify-offline.mjs
if ($LASTEXITCODE -ne 0) { throw 'Offline checks failed; no database credentials requested.' }
Write-Host 'Finance STORAGE rehearsal targets localhost/greenfield_report_cards_disposable only.'
Write-Host 'Creates and removes one generated fictional schema. Creates no roles; staging and existing data are untouched.'
Write-Host 'This is an owner-run constraint/rollback check, not authenticated finance saving or restricted-role proof.'
$names = @('REPORT_CARD_TEST_DATABASE_URL', 'REPORT_CARD_TEST_CONFIRM')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $financeDbUser = Read-Host 'Authorized LOCAL disposable PostgreSQL superuser (usually postgres)'
    $secure = Read-Host 'LOCAL disposable PostgreSQL password (not a staging password)' -AsSecureString
    $credential = [System.Net.NetworkCredential]::new($financeDbUser, $secure)
    $encodedUser = [uri]::EscapeDataString($credential.UserName)
    $encodedPassword = [uri]::EscapeDataString($credential.Password)
    $env:REPORT_CARD_TEST_DATABASE_URL = "postgresql://${encodedUser}:${encodedPassword}@localhost:5432/greenfield_report_cards_disposable"
    $env:REPORT_CARD_TEST_CONFIRM = 'DISPOSABLE_REPORT_CARD_TEST_ONLY'
    & node .\scripts\finance-storage-postgres-integration.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Finance storage rehearsal did not pass. Share its bounded FAIL line only.' }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    Remove-Variable financeDbUser, secure, credential, encodedUser, encodedPassword, previous -ErrorAction SilentlyContinue
}
