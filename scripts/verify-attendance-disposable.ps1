# One consolidated offline + opt-in local disposable database rehearsal.
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
$previousUrl = $env:REPORT_CARD_TEST_DATABASE_URL
$previousConfirm = $env:REPORT_CARD_TEST_CONFIRM
$previousRoleConfirm = $env:REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM
try {
    node .\scripts\verify-offline.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Offline checks failed; no database credentials requested.' }
    Write-Host 'Attendance rehearsal targets localhost/greenfield_report_cards_disposable only.'
    Write-Host 'It creates and removes one generated fixture schema and two temporary roles. Existing staging data is untouched.'
    $attendancePgUser = Read-Host 'Authorized local disposable PostgreSQL superuser (usually postgres)'
    $attendanceSecurePassword = Read-Host 'Local disposable PostgreSQL password' -AsSecureString
    $attendanceCredential = [System.Net.NetworkCredential]::new($attendancePgUser, $attendanceSecurePassword)
    $attendanceEncodedUser = [uri]::EscapeDataString($attendanceCredential.UserName)
    $attendanceEncodedPassword = [uri]::EscapeDataString($attendanceCredential.Password)
    $env:REPORT_CARD_TEST_DATABASE_URL = "postgresql://${attendanceEncodedUser}:${attendanceEncodedPassword}@localhost:5432/greenfield_report_cards_disposable"
    $env:REPORT_CARD_TEST_CONFIRM = 'DISPOSABLE_REPORT_CARD_TEST_ONLY'
    $env:REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM = 'DISPOSABLE_ROLE_ADMIN_TEST_ONLY'
    node --experimental-strip-types .\scripts\attendance-postgres-integration.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Attendance PostgreSQL rehearsal did not pass. Share its bounded FAIL line.' }
} finally {
    $env:REPORT_CARD_TEST_DATABASE_URL = $previousUrl
    $env:REPORT_CARD_TEST_CONFIRM = $previousConfirm
    $env:REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM = $previousRoleConfirm
    Remove-Variable attendancePgUser, attendanceSecurePassword, attendanceCredential, attendanceEncodedUser, attendanceEncodedPassword -ErrorAction SilentlyContinue
    Pop-Location
}
