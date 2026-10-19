$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $PSScriptRoot "NOTAUpdater.cs"
$output = Join-Path $repositoryRoot "extension\updater\NOTAUpdater.exe"
$compiler = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path -LiteralPath $compiler)) {
    throw "Cannot find C# compiler: $compiler"
}

New-Item -ItemType Directory -Path (Split-Path -Parent $output) -Force | Out-Null
& $compiler /nologo /optimize+ /target:exe /out:$output `
    /reference:System.Web.Extensions.dll `
    /reference:System.IO.Compression.dll `
    /reference:System.IO.Compression.FileSystem.dll `
    $source
if ($LASTEXITCODE -ne 0) { throw "NOTAUpdater build failed." }
Write-Host "Built $output"
