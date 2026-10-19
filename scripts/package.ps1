$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$extensionRoot = Join-Path $repositoryRoot "extension"
$manifestPath = Join-Path $extensionRoot "manifest.json"
$distributionRoot = Join-Path $repositoryRoot "dist"

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Không tìm thấy manifest: $manifestPath"
}

$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
$version = [string]$manifest.version
if ($version -notmatch '^\d+\.\d+\.\d+(\.\d+)?$') {
    throw "Version không hợp lệ trong manifest: $version"
}

New-Item -ItemType Directory -Path $distributionRoot -Force | Out-Null
$archiveName = "NOTA_Labeling_Organizer_Extension_v$version.zip"
$archivePath = Join-Path $distributionRoot $archiveName
$temporaryPath = Join-Path $distributionRoot "$archiveName.new.zip"

if (Test-Path -LiteralPath $temporaryPath) {
    Remove-Item -LiteralPath $temporaryPath -Force
}

Compress-Archive -Path (Join-Path $extensionRoot '*') -DestinationPath $temporaryPath -CompressionLevel Optimal
Move-Item -LiteralPath $temporaryPath -Destination $archivePath -Force

$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath
Write-Host "Đã tạo: $archivePath"
Write-Host "SHA256: $($hash.Hash)"
