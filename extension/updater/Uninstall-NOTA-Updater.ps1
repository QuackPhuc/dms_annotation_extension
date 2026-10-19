$ErrorActionPreference = "Stop"
$hostName = "ai.nota.labeling_updater"
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
$installRoot = Join-Path $env:LOCALAPPDATA "NOTA\LabelingUpdater"

if (Test-Path -LiteralPath $registryPath) { Remove-Item -LiteralPath $registryPath -Force }
if (Test-Path -LiteralPath $installRoot) {
    $resolved = [System.IO.Path]::GetFullPath($installRoot)
    $expected = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "NOTA\LabelingUpdater"))
    if ($resolved -ne $expected) { throw "Đường dẫn uninstall không hợp lệ: $resolved" }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
Write-Host "Đã gỡ NOTA Updater."
