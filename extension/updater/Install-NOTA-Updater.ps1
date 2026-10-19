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
    throw "Cannot find manifest in $extensionRoot"
}
if (-not (Test-Path -LiteralPath $sourceExe)) {
    throw "Cannot find NOTAUpdater.exe"
}

if ($ExtensionId -match '^[a-p]{32}$') { [void]$extensionIds.Add($ExtensionId) }
$chromeRoots = @(
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"),
    (Join-Path $env:LOCALAPPDATA "Google\Chrome Beta\User Data"),
    (Join-Path $env:LOCALAPPDATA "Google\Chrome SxS\User Data"),
    (Join-Path $env:LOCALAPPDATA "Chromium\User Data")
)
$expectedExtensionPath = $extensionRoot.TrimEnd('\', '/')
foreach ($chromeUserData in $chromeRoots) {
    if (-not (Test-Path -LiteralPath $chromeUserData)) { continue }
    Get-ChildItem -LiteralPath $chromeUserData -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        foreach ($preferencesName in @("Secure Preferences", "Preferences")) {
            $preferencesPath = Join-Path $_.FullName $preferencesName
            if (-not (Test-Path -LiteralPath $preferencesPath)) { continue }
            try {
                $preferences = Get-Content -Raw -Encoding UTF8 -LiteralPath $preferencesPath | ConvertFrom-Json
                if (-not $preferences.extensions.settings) { continue }
                foreach ($entry in $preferences.extensions.settings.PSObject.Properties) {
                    $configuredPath = [string]$entry.Value.path
                    if (-not $configuredPath) { continue }
                    try { $configuredPath = [System.IO.Path]::GetFullPath($configuredPath).TrimEnd('\', '/') } catch { continue }
                    if ($configuredPath -eq $expectedExtensionPath) { [void]$extensionIds.Add($entry.Name) }
                }
            } catch { }
        }
    }
}
if ($extensionIds.Count -eq 0) {
    Write-Host "Cannot automatically find the Extension ID." -ForegroundColor Yellow
    Write-Host "Open chrome://extensions, enable Developer mode, then copy the ID shown under NOTA Labeling Organizer."
    $manualId = ([string](Read-Host "Paste Extension ID")).Trim().ToLowerInvariant()
    if ($manualId -notmatch '^[a-p]{32}$') {
        throw "Extension ID is invalid. It must contain 32 letters from a to p."
    }
    [void]$extensionIds.Add($manualId)
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
