#!/usr/bin/env pwsh
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string] $Command
)

$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
$VencordRoot = Join-Path $env:APPDATA "Vencord"
$ThemeDirectory = Join-Path $VencordRoot "themes"
$SettingsPath = Join-Path $VencordRoot "settings\settings.json"
$ActiveFileName = "MyTheme-Active.css"
$ActivePath = Join-Path $ThemeDirectory $ActiveFileName
$StatePath = Join-Path $ThemeDirectory ".vtheme-current"
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$Presets = [ordered]@{
    black  = "MyTheme-Black.css"
    gothic = "MyTheme-Gothic.css"
    green  = "MyTheme-Green.css"
    purple = "MyTheme-Purple.css"
    red    = "MyTheme-Red.css"
}

$Aliases = @{
    b = "black"
    dark = "black"
    goth = "gothic"
    g = "green"
    p = "purple"
    r = "red"
}

function Write-Utf8Atomic {
    param(
        [Parameter(Mandatory)] [string] $Path,
        [Parameter(Mandatory)] [string] $Content
    )

    if ((Test-Path -LiteralPath $Path) -and
        ([System.IO.File]::ReadAllText($Path) -ceq $Content)) {
        return
    }

    $temporaryPath = "$Path.tmp"
    [System.IO.File]::WriteAllText($temporaryPath, $Content, $Utf8NoBom)
    Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
}

function Convert-ToLocalTheme {
    param([Parameter(Mandatory)] [string] $Content)

    $content = $Content.Replace(
        "https://raw.githubusercontent.com/depolaries/Theme-Vencord/main/Base.css",
        "./Base.css"
    )
    return $content.Replace(
        "https://raw.githubusercontent.com/depolaries/Theme-Vencord/main/MyTheme-Black.css",
        "./MyTheme-Black.css"
    )
}

function Sync-ThemeFiles {
    New-Item -ItemType Directory -Path $ThemeDirectory -Force | Out-Null

    $files = @("Base.css", "MyTheme.css") + @($Presets.Values)
    foreach ($fileName in $files) {
        $sourcePath = Join-Path $RepoRoot $fileName
        if (-not (Test-Path -LiteralPath $sourcePath)) {
            throw "Theme source not found: $sourcePath"
        }

        $content = [System.IO.File]::ReadAllText($sourcePath)
        if ($fileName -ne "Base.css") {
            $content = Convert-ToLocalTheme $content
        }
        Write-Utf8Atomic -Path (Join-Path $ThemeDirectory $fileName) -Content $content
    }
}

function Resolve-ThemeName {
    param([Parameter(Mandatory)] [string] $Name)

    $normalized = $Name.Trim().ToLowerInvariant()
    if ($Aliases.ContainsKey($normalized)) {
        $normalized = $Aliases[$normalized]
    }
    if (-not $Presets.Contains($normalized)) {
        throw "Unknown theme '$Name'. Use: $($Presets.Keys -join ', ')."
    }
    return $normalized
}

function Get-CurrentTheme {
    if (Test-Path -LiteralPath $StatePath) {
        $saved = [System.IO.File]::ReadAllText($StatePath).Trim().ToLowerInvariant()
        if ($Presets.Contains($saved)) {
            return $saved
        }
    }

    if (Test-Path -LiteralPath $SettingsPath) {
        $settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
        foreach ($entry in @($settings.enabledThemes)) {
            foreach ($pair in $Presets.GetEnumerator()) {
                if ($entry -eq $pair.Value) {
                    return $pair.Key
                }
            }
        }
    }

    return "green"
}

function Test-ActiveThemeEnabled {
    if (-not (Test-Path -LiteralPath $SettingsPath)) {
        return $false
    }
    $settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
    return $ActiveFileName -in @($settings.enabledThemes)
}

function Enable-ActiveTheme {
    if (-not (Test-Path -LiteralPath $SettingsPath)) {
        throw "Vencord settings not found: $SettingsPath"
    }

    $backupPath = "$SettingsPath.vtheme-backup"
    if (-not (Test-Path -LiteralPath $backupPath)) {
        Copy-Item -LiteralPath $SettingsPath -Destination $backupPath
    }

    $settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
    $managedFiles = @($Presets.Values) + @("MyTheme.css", $ActiveFileName)
    $enabledThemes = @($settings.enabledThemes | Where-Object { $_ -notin $managedFiles })
    $settings.enabledThemes = @($enabledThemes) + $ActiveFileName
    $json = $settings | ConvertTo-Json -Depth 100
    Write-Utf8Atomic -Path $SettingsPath -Content ($json + [Environment]::NewLine)
}

function Set-Theme {
    param([Parameter(Mandatory)] [string] $Name)

    $resolvedName = Resolve-ThemeName $Name
    Sync-ThemeFiles

    $sourcePath = Join-Path $ThemeDirectory $Presets[$resolvedName]
    $content = [System.IO.File]::ReadAllText($sourcePath)
    $displayName = (Get-Culture).TextInfo.ToTitleCase($resolvedName)
    $content = [regex]::Replace(
        $content,
        '(?m)^ \* @name .+$',
        " * @name MyTheme Active - $displayName"
    )
    $content = [regex]::Replace(
        $content,
        '(?m)^ \* @description .+$',
        " * @description Managed by VTheme. Current preset: $displayName."
    )

    Write-Utf8Atomic -Path $ActivePath -Content $content
    Write-Utf8Atomic -Path $StatePath -Content ($resolvedName + [Environment]::NewLine)

    if (-not (Test-ActiveThemeEnabled)) {
        Write-Warning "MyTheme-Active.css is not enabled yet. Run 'VTheme install', then reload Discord once."
    }

    Write-Host "VTheme: $displayName" -ForegroundColor Green
}

function Show-ThemeList {
    $current = Get-CurrentTheme
    foreach ($name in $Presets.Keys) {
        $marker = if ($name -eq $current) { "*" } else { " " }
        Write-Host "$marker $name"
    }
}

function Show-Help {
    Write-Host "VTheme [black|gothic|green|purple|red]"
    Write-Host "VTheme next      Switch to the next preset"
    Write-Host "VTheme current   Print the current preset"
    Write-Host "VTheme list      List available presets"
    Write-Host "VTheme sync      Copy repository themes to Vencord"
    Write-Host "VTheme install   Enable the hot-swappable active theme"
}

if ([string]::IsNullOrWhiteSpace($Command)) {
    Show-ThemeList
    $Command = Read-Host "Choose a theme"
}

switch ($Command.Trim().ToLowerInvariant()) {
    "help" { Show-Help; break }
    "-h" { Show-Help; break }
    "--help" { Show-Help; break }
    "list" { Show-ThemeList; break }
    "current" { Write-Host (Get-CurrentTheme); break }
    "sync" {
        Set-Theme (Get-CurrentTheme)
        break
    }
    "install" {
        $current = Get-CurrentTheme
        Sync-ThemeFiles
        Enable-ActiveTheme
        Set-Theme $current
        Write-Host "Installed. Reload Discord once; later switches are hot-reloaded." -ForegroundColor Cyan
        break
    }
    "next" {
        $names = @($Presets.Keys)
        $currentIndex = [Array]::IndexOf($names, (Get-CurrentTheme))
        $nextIndex = ($currentIndex + 1) % $names.Count
        Set-Theme $names[$nextIndex]
        break
    }
    default { Set-Theme $Command }
}
