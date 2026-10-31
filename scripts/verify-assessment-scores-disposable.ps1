# One combined offline + explicitly local schema-faithful score-save rehearsal.
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
$previousUrl = $env:REPORT_CARD_TEST_DATABASE_URL
$previousConfirm = $env:REPORT_CARD_TEST_CONFIRM
$previousRoleConfirm = $env:REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM
try {
    node .\scripts\verify-offline.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Offline checks failed; no database credentials requested.' }
    Write-Host 'Assessment score rehearsal targets localhost/greenfield_report_cards_disposable only.'
    Write-Host 'Creates and removes one generated upgraded schema and five temporary roles, including an unprivileged LOGIN.'
    Write-Host 'Greenfield staging attendance, scores and published reports are untouched.'
    $scorePgUser = Read-Host 'Authorized LOCAL disposable PostgreSQL superuser (usually postgres)'
    $scoreSecure = Read-Host 'LOCAL disposable PostgreSQL password (not a staging password)' -AsSecureString
    $scoreCredential = [System.Net.NetworkCredential]::new($scorePgUser, $scoreSecure)
    $scoreUserEncoded = [uri]::EscapeDataString($scoreCredential.UserName)
    $scorePasswordEncoded = [uri]::EscapeDataString($scoreCredential.Password)
    $env:REPORT_CARD_TEST_DATABASE_URL = "postgresql://${scoreUserEncoded}:${scorePasswordEncoded}@localhost:5432/greenfield_report_cards_disposable"
    $env:REPORT_CARD_TEST_CONFIRM = 'DISPOSABLE_REPORT_CARD_TEST_ONLY'
    $env:REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM = 'DISPOSABLE_ROLE_ADMIN_TEST_ONLY'
    node --experimental-strip-types .\scripts\assessment-score-postgres-integration.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Assessment score rehearsal did not pass. Share its bounded FAIL line.' }
} finally {
    $env:REPORT_CARD_TEST_DATABASE_URL = $previousUrl
    $env:REPORT_CARD_TEST_CONFIRM = $previousConfirm
    $env:REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM = $previousRoleConfirm
    Remove-Variable scorePgUser, scoreSecure, scoreCredential, scoreUserEncoded, scorePasswordEncoded -ErrorAction SilentlyContinue
    Pop-Location
}
