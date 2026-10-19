param([string]$ExtensionId = "")

$ErrorActionPreference = "Stop"

$hostName = "ai.nota.labeling_updater"
$releaseApi = "https://api.github.com/repos/tanmainhat0502/dms_annotation_extension/releases/latest"
$extensionRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$sourceExe = Join-Path $PSScriptRoot "NOTAUpdater.exe"
$installRoot = Join-Path $env:LOCALAPPDATA "NOTA\LabelingUpdater"
$installedExe = Join-Path $installRoot "NOTAUpdater.exe"
$configPath = Join-Path $installRoot "config.json"
$hostManifestPath = Join-Path $installRoot "$hostName.json"
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$extensionIds = New-Object System.Collections.Generic.HashSet[string] ([System.StringComparer]::OrdinalIgnoreCase)

if (-not (Test-Path -LiteralPath (Join-Path $extensionRoot "manifest.json"))) {
    throw "Không tìm thấy manifest trong $extensionRoot"
}
if (-not (Test-Path -LiteralPath $sourceExe)) {
    throw "Không tìm thấy NOTAUpdater.exe"
}

if ($ExtensionId -match '^[a-p]{32}$') { [void]$extensionIds.Add($ExtensionId) }
$chromeUserData = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"
if (Test-Path -LiteralPath $chromeUserData) {
    Get-ChildItem -LiteralPath $chromeUserData -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $preferencesPath = Join-Path $_.FullName "Secure Preferences"
        if (-not (Test-Path -LiteralPath $preferencesPath)) { return }
        try {
            $preferences = Get-Content -Raw -Encoding UTF8 -LiteralPath $preferencesPath | ConvertFrom-Json
            foreach ($entry in $preferences.extensions.settings.PSObject.Properties) {
                $configuredPath = [string]$entry.Value.path
                if (-not $configuredPath) { continue }
                try { $configuredPath = [System.IO.Path]::GetFullPath($configuredPath).TrimEnd('\') } catch { continue }
                if ($configuredPath -eq $extensionRoot.TrimEnd('\')) { [void]$extensionIds.Add($entry.Name) }
            }
        } catch { }
    }
}
if ($extensionIds.Count -eq 0) {
    throw "Không tìm thấy Extension ID. Hãy Load unpacked thư mục này trong Chrome trước, rồi chạy lại file cài updater."
}
$allowedOrigins = @($extensionIds | ForEach-Object { "chrome-extension://$_/" })

New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
Copy-Item -LiteralPath $sourceExe -Destination $installedExe -Force

$config = [ordered]@{
    extensionPath = $extensionRoot
    allowedOrigins = $allowedOrigins
    releaseApi = $releaseApi
} | ConvertTo-Json
[System.IO.File]::WriteAllText($configPath, $config, $utf8NoBom)

$hostManifest = [ordered]@{
    name = $hostName
    description = "One-click updater for NOTA Labeling Organizer"
    path = $installedExe
    type = "stdio"
    allowed_origins = $allowedOrigins
} | ConvertTo-Json
[System.IO.File]::WriteAllText($hostManifestPath, $hostManifest, $utf8NoBom)

New-Item -Path $registryPath -Force | Out-Null
Set-Item -Path $registryPath -Value $hostManifestPath

Write-Host "Da cai NOTA Updater cho extension: $extensionRoot"
Write-Host "Extension ID: $($extensionIds -join ', ')"
Write-Host "Dong va mo lai popup extension de kiem tra."
