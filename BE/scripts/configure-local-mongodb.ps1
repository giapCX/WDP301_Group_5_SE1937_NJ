#Requires -RunAsAdministrator
param(
  [string]$ServiceName = 'MongoDB',
  [string]$ConfigPath = ''
)
$ErrorActionPreference = 'Stop'
$backendPath = Split-Path -Parent $PSScriptRoot
if (-not $ConfigPath) {
  $service = Get-CimInstance Win32_Service | Where-Object Name -eq $ServiceName
  if (-not $service -or $service.PathName -notmatch '--config\s+"([^"]+)"') {
    throw 'Cannot detect mongod.cfg from the service. Supply -ConfigPath explicitly.'
  }
  $ConfigPath = $Matches[1]
}
$configFile = (Resolve-Path -LiteralPath $ConfigPath).Path
$storagePath = Join-Path $backendPath 'storage'
New-Item -ItemType Directory -Path $storagePath -Force | Out-Null
$content = [IO.File]::ReadAllText($configFile)
if ($content -notmatch '(?m)^replication:\s*$') {
  $backup = Join-Path $storagePath ('mongod-before-replica-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.cfg')
  Copy-Item -LiteralPath $configFile -Destination $backup
  Add-Content -LiteralPath $configFile -Value "`nreplication:`n  replSetName: rentalLocal"
  Restart-Service -Name $ServiceName
} elseif ($content -notmatch '(?m)^\s+replSetName:\s*rentalLocal\s*$') {
  throw 'Existing replication settings differ. Inspect mongod.cfg before changing them.'
} elseif ((Get-Service -Name $ServiceName).Status -ne 'Running') {
  Start-Service -Name $ServiceName
}
& node (Join-Path $PSScriptRoot 'start-local-db.js')
if ($LASTEXITCODE -ne 0) { throw 'Replica-set initialization failed. See the error above.' }
Write-Output 'MongoDB ready on port 27017 with replica set rentalLocal.'

