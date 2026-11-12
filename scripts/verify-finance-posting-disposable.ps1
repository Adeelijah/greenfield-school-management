param([switch]$Upgraded)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path '.\node_modules\postgres')) { throw 'Run from the Greenfield repository root with existing dependencies.' }
& node .\scripts\verify-offline.mjs
if ($LASTEXITCODE -ne 0) { throw 'Offline checks failed; no database credentials requested.' }
Write-Host 'Finance restricted POSTING rehearsal targets localhost/greenfield_report_cards_disposable only.'
if ($Upgraded) {
    Write-Host 'Uses the upgraded academic/report schema fixture and five temporary local roles.'
} else {
    Write-Host 'Uses the minimal finance fixture and three temporary local roles.'
}
Write-Host 'Creates and removes one generated fictional schema. Staging and existing data are untouched.'
Write-Host 'This exercises the private posting function under two dedicated local login sessions; no live SDK or finance UI is enabled.'
$names = @('REPORT_CARD_TEST_DATABASE_URL', 'REPORT_CARD_TEST_CONFIRM', 'REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM')
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
    $env:REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM = 'DISPOSABLE_ROLE_ADMIN_TEST_ONLY'
    if ($Upgraded) {
        & node --experimental-strip-types .\scripts\finance-posting-postgres-integration.mjs --upgraded
    } else {
        & node --experimental-strip-types .\scripts\finance-posting-postgres-integration.mjs
    }
    if ($LASTEXITCODE -ne 0) { throw 'Finance posting rehearsal did not pass. Share its bounded FAIL line only.' }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    Remove-Variable financeDbUser, secure, credential, encodedUser, encodedPassword, previous -ErrorAction SilentlyContinue
}
