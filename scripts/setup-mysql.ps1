param(
  [string]$MySqlVersion = "8.4",
  [string]$ServiceName = "MySQL84",
  [string]$RootPassword = "root_dev_123",
  [string]$AppUser = "easybill",
  [string]$AppPassword = "easybill_dev_123",
  [string]$Database = "easybill"
)

$baseDir = "C:\Program Files\MySQL\MySQL Server $MySqlVersion"
$binDir = Join-Path $baseDir "bin"
$mysqld = Join-Path $binDir "mysqld.exe"
$mysql = Join-Path $binDir "mysql.exe"
$dataDir = "C:\ProgramData\MySQL\MySQL Server $MySqlVersion\Data"
$iniPath = "C:\ProgramData\MySQL\MySQL Server $MySqlVersion\my.ini"

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
  Write-Error "Ouvre PowerShell en Administrateur puis relance ce script."
  exit 1
}

if (-not (Test-Path $mysqld)) {
  Write-Error "mysqld introuvable: $mysqld"
  exit 1
}

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
  Stop-Service $ServiceName -ErrorAction SilentlyContinue
}

@"
[mysqld]
basedir="$($baseDir -replace '\\','/')"
datadir="$($dataDir -replace '\\','/')"
port=3306
sql_mode=STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
log-error="$($dataDir -replace '\\','/')/mysql.err"

[client]
port=3306
default-character-set=utf8mb4
"@ | Set-Content -Path $iniPath -Encoding ASCII

if (-not (Test-Path (Join-Path $dataDir "mysql"))) {
  & $mysqld --defaults-file="$iniPath" --initialize-insecure --basedir="$baseDir" --datadir="$dataDir"
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Echec de l'initialisation MySQL. Verifie le contenu de $dataDir."
    exit 1
  }
}

$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $existingService) {
  & $mysqld --install $ServiceName --basedir="$baseDir" --datadir="$dataDir" --defaults-file="$iniPath"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Echec install via mysqld --install. Tentative via sc.exe..."
    $binPath = "`"$mysqld`" --defaults-file=`"$iniPath`""
    & cmd /c "sc.exe create $ServiceName binPath= ""$binPath"" start= auto"
    if ($LASTEXITCODE -ne 0) {
      Write-Error "Echec installation du service '$ServiceName'. Verifie les droits admin."
      exit 1
    }
  }
  $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
}

if (-not $existingService) {
  Write-Error "Service '$ServiceName' introuvable apres installation. Verifie les droits admin."
  exit 1
}

try {
  Start-Service $ServiceName -ErrorAction Stop
} catch {
  Write-Error "Impossible de demarrer le service '$ServiceName'."
  throw
}

& $mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$RootPassword';"
if ($LASTEXITCODE -ne 0) {
  Write-Error "Connexion MySQL impossible. Verifie que le service tourne et que le port 3306 est libre."
  exit 1
}

& $mysql -u root -p$RootPassword -e "CREATE DATABASE IF NOT EXISTS $Database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS '$AppUser'@'localhost' IDENTIFIED BY '$AppPassword'; GRANT ALL PRIVILEGES ON $Database.* TO '$AppUser'@'localhost'; FLUSH PRIVILEGES;"

Write-Host "MySQL configure. Service: $ServiceName. Base: $Database. User: $AppUser"
