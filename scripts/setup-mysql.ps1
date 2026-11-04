param(
  [string]$AdminUser = 'root'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$schemaPath = Join-Path $projectRoot 'database\schema.sql'
$envPath = Join-Path $projectRoot '.env'
$tempSqlPath = Join-Path ([System.IO.Path]::GetTempPath()) ("quickhatid-db-setup-{0}.sql" -f [Guid]::NewGuid().ToString('N'))

$mysqlCommand = Get-Command mysql.exe -ErrorAction SilentlyContinue
if ($mysqlCommand) {
  $mysqlPath = $mysqlCommand.Source
} else {
  $mysqlPath = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'
  if (-not (Test-Path $mysqlPath)) {
    throw 'mysql.exe was not found. Add the MySQL Server bin directory to PATH or install MySQL Server 8.'
  }
}

if (-not (Test-Path $schemaPath)) {
  throw "Database schema was not found: $schemaPath"
}

$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $passwordBytes = New-Object byte[] 32
  $sessionBytes = New-Object byte[] 48
  $random.GetBytes($passwordBytes)
  $random.GetBytes($sessionBytes)
} finally {
  $random.Dispose()
}
$appPassword = ([BitConverter]::ToString($passwordBytes)).Replace('-', '').ToLowerInvariant()
$sessionSecret = [Convert]::ToBase64String($sessionBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
$sql = @"
$(Get-Content -Raw $schemaPath)
CREATE USER IF NOT EXISTS 'quickhatid_app'@'127.0.0.1' IDENTIFIED BY '$appPassword';
ALTER USER 'quickhatid_app'@'127.0.0.1' IDENTIFIED BY '$appPassword';
GRANT SELECT, INSERT, UPDATE, DELETE ON quickhatid_db.* TO 'quickhatid_app'@'127.0.0.1';
"@

$existingLines = @()
if (Test-Path $envPath) {
  $existingLines = @(Get-Content $envPath | Where-Object {
    $_ -notmatch '^\s*(PORT|NODE_ENV|DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD|SESSION_SECRET|APP_ORIGIN)\s*='
  })
}
$envLines = @(
  'PORT=3001'
  'NODE_ENV=development'
  'APP_ORIGIN=http://localhost:5173'
  "SESSION_SECRET=$sessionSecret"
  'DB_HOST=127.0.0.1'
  'DB_PORT=3306'
  'DB_NAME=quickhatid_db'
  'DB_USER=quickhatid_app'
  "DB_PASSWORD=$appPassword"
) + $existingLines

try {
  [System.IO.File]::WriteAllText($tempSqlPath, $sql, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "Connecting to MySQL as '$AdminUser'. Enter that account's password at the MySQL prompt."
  Write-Host 'The application password will be generated locally and saved only in .env.'
  Get-Content $tempSqlPath | & $mysqlPath "--user=$AdminUser" '--password' '--default-character-set=utf8mb4'
  if ($LASTEXITCODE -ne 0) {
    throw 'MySQL setup failed. Verify the administrator login and ensure it can create databases and users.'
  }

  [System.IO.File]::WriteAllText($envPath, ($envLines -join [Environment]::NewLine) + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host ''
  Write-Host 'QuickHatid MySQL is configured successfully.'
  Write-Host 'The database schema and least-privilege app user are ready; generated credentials were saved to .env.'
  Write-Host 'Restart the app with: npm run dev'
} finally {
  if (Test-Path $tempSqlPath) {
    Remove-Item -LiteralPath $tempSqlPath -Force
  }
  [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
  [Array]::Clear($sessionBytes, 0, $sessionBytes.Length)
}
