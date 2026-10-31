param([switch]$EnableTestWrites, [switch]$EnableAttendance, [switch]$EnableAttendanceWrites)
$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$next = Join-Path $root "node_modules/next/dist/bin/next"
if (-not (Test-Path $next)) { throw "Run from the Greenfield repository root with its existing dependencies. Do not install dependencies for this launcher." }
$certificate = Join-Path $root "recovery-artifacts/greenfield-staging-ca.crt"
if (-not (Test-Path $certificate)) { throw "Place the downloaded staging CA certificate at recovery-artifacts/greenfield-staging-ca.crt first." }
$names = @("NODE_ENV", "NODE_EXTRA_CA_CERTS", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "GREENFIELD_STAGING_UI", "GREENFIELD_STAGING_COMMANDS", "GREENFIELD_STAGING_DATABASE_URL", "GREENFIELD_STAGING_ATTENDANCE", "GREENFIELD_STAGING_ATTENDANCE_DATABASE_URL", "GREENFIELD_STAGING_DB_CA_FILE", "DATABASE_URL", "MIGRATION_DATABASE_URL", "GREENFIELD_VERIFIED_DB_ROLE", "SUPABASE_SERVICE_ROLE_KEY")
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, "Process") }
try {
    Write-Host "Greenfield LOCAL staging UI. Target hweoqkbgmzycyznrbvng. Normal application routes remain unavailable."
    $key = Read-Host "Staging publishable key (or legacy anon key)"
    $secure = Read-Host "Existing greenfield_app database password" -AsSecureString
    $credential = [System.Net.NetworkCredential]::new("", $secure)
    $encoded = [uri]::EscapeDataString($credential.Password)
    $env:NODE_ENV = "development"
    $env:NODE_EXTRA_CA_CERTS = $certificate
    $env:NEXT_PUBLIC_SUPABASE_URL = "https://hweoqkbgmzycyznrbvng.supabase.co"
    $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $key
    $env:GREENFIELD_STAGING_UI = "LOCAL_STAGING_REPORTS_ONLY"
    $env:GREENFIELD_STAGING_COMMANDS = "DISABLED"
    if ($EnableTestWrites) {
        Write-Host "Test writes enabled: browser report actions persist fictional staging records, unlike the earlier rollback harness."
        $env:GREENFIELD_STAGING_COMMANDS = "FICTIONAL_STAGING_WRITES_ONLY"
    } else { Write-Host "Read-only mode: report commands disabled." }
    $env:GREENFIELD_STAGING_DATABASE_URL = "postgresql://greenfield_app.hweoqkbgmzycyznrbvng:${encoded}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
    $env:GREENFIELD_STAGING_ATTENDANCE = "DISABLED"
    $env:GREENFIELD_STAGING_ATTENDANCE_DATABASE_URL = "STAGING_ATTENDANCE_DISABLED"
    if ($EnableAttendance -or $EnableAttendanceWrites) {
        $attendanceSecure = Read-Host "Existing dedicated greenfield_attendance_app password" -AsSecureString
        $attendanceCredential = [System.Net.NetworkCredential]::new("", $attendanceSecure)
        $attendanceEncoded = [uri]::EscapeDataString($attendanceCredential.Password)
        $env:GREENFIELD_STAGING_ATTENDANCE_DATABASE_URL = "postgresql://greenfield_attendance_app.hweoqkbgmzycyznrbvng:${attendanceEncoded}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
        $env:GREENFIELD_STAGING_ATTENDANCE = "READ_ONLY"
        if ($EnableAttendanceWrites) {
            $env:GREENFIELD_STAGING_ATTENDANCE = "FICTIONAL_STAGING_ATTENDANCE_WRITES_ONLY"
            Write-Host "Attendance Save enabled for fictional staging registers and reasoned corrections."
        } else { Write-Host "Saved attendance is read-only. Attendance Save disabled." }
    }
    $env:GREENFIELD_STAGING_DB_CA_FILE = $certificate
    # Nonempty sentinels prevent Next dotenv loading from filling these variables.
    # Windows PowerShell removes environment variables assigned an empty string.
    $env:DATABASE_URL = "STAGING_DISABLED_NO_DEFAULT_DATABASE"
    $env:MIGRATION_DATABASE_URL = "STAGING_DISABLED_NO_MIGRATION_DATABASE"
    $env:GREENFIELD_VERIFIED_DB_ROLE = "STAGING_DISABLED"
    $env:SUPABASE_SERVICE_ROLE_KEY = "STAGING_DISABLED"
    Remove-Variable attendanceSecure, attendanceCredential, attendanceEncoded, secure, credential, encoded, key -ErrorAction SilentlyContinue
    Write-Host "Open http://127.0.0.1:3000/staging/login and use an existing fictional staff account. Ctrl+C stops the server."
    & node $next dev --hostname 127.0.0.1 --port 3000
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], "Process") }
    Remove-Variable attendanceSecure, attendanceCredential, attendanceEncoded, secure, credential, encoded, key, previous -ErrorAction SilentlyContinue
}
