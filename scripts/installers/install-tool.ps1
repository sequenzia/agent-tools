# install-tool.ps1 - Install a tool from pre-built binaries
#
# Usage:
#   $env:TOOL_NAME = "mytool"; $env:TOOL_BASE_URL = "https://gitlab.com/myorg/mytool"; irm https://example.com/install-tool.ps1 | iex
#   .\install-tool.ps1 -Name "mytool" -BaseUrl "https://gitlab.com/myorg/mytool"
#   .\install-tool.ps1 -Name "mytool" -BaseUrl "https://gitlab.com/myorg/mytool" -Version "1.2.0"
#   .\install-tool.ps1 -Name "mytool" -BaseUrl "https://github.com/myorg/mytool" `
#     -DownloadUrl '{base_url}/releases/download/v{version}/{name}_{version}_{os}_{arch}.{ext}' `
#     -ApiUrl 'https://api.github.com/repos/myorg/mytool/releases/latest' `
#     -VersionJsonPath '.tag_name'
#
# Required environment variables (or CLI parameters):
#   TOOL_NAME       - Binary name (e.g., glab, myctl)
#   TOOL_BASE_URL   - Base project URL (e.g., https://gitlab.com/gitlab-org/cli)
#
# Optional environment variables:
#   TOOL_VERSION          - Pin a specific version (default: auto-detect latest)
#   TOOL_INSTALL_DIR      - Override install directory (default: ~\.local\bin)
#   TOOL_DOWNLOAD_URL     - Download URL template with placeholders (default: GitLab pattern)
#   TOOL_API_URL          - Full API URL for version detection (default: derived from base URL)
#   TOOL_VERSION_JSONPATH - jq-style expression to extract version (default: auto-detect)
#
# URL template placeholders:
#   {base_url} {version} {name} {os} {arch} {ext}
#
# Default download URL pattern (GitLab):
#   {base_url}/-/releases/v{version}/downloads/{name}_{version}_{os}_{arch}.{ext}

param(
    [string]$Name,
    [string]$BaseUrl,
    [string]$Version,
    [string]$InstallDir,
    [string]$DownloadUrl,
    [string]$ApiUrl,
    [string]$VersionJsonPath
)

$ErrorActionPreference = "Stop"

# -- Defaults ------------------------------------------------------------------
$DefaultInstallDir = Join-Path $env:USERPROFILE ".local\bin"

# -- Resolve parameters (CLI args > env vars > defaults) -----------------------
if (-not $Name)            { $Name            = if ($env:TOOL_NAME)             { $env:TOOL_NAME }             else { "" } }
if (-not $BaseUrl)         { $BaseUrl         = if ($env:TOOL_BASE_URL)         { $env:TOOL_BASE_URL }         else { "" } }
if (-not $Version)         { $Version         = if ($env:TOOL_VERSION)          { $env:TOOL_VERSION }          else { "" } }
if (-not $InstallDir)      { $InstallDir      = if ($env:TOOL_INSTALL_DIR)      { $env:TOOL_INSTALL_DIR }      else { $DefaultInstallDir } }
if (-not $DownloadUrl)     { $DownloadUrl     = if ($env:TOOL_DOWNLOAD_URL)     { $env:TOOL_DOWNLOAD_URL }     else { "" } }
if (-not $ApiUrl)          { $ApiUrl          = if ($env:TOOL_API_URL)          { $env:TOOL_API_URL }          else { "" } }
if (-not $VersionJsonPath) { $VersionJsonPath = if ($env:TOOL_VERSION_JSONPATH) { $env:TOOL_VERSION_JSONPATH } else { "" } }

# -- Validate required parameters ----------------------------------------------
if (-not $Name)    { Write-Host "[error] Name is required. Set it via -Name parameter or TOOL_NAME env var." -ForegroundColor Red; exit 1 }
if (-not $BaseUrl) { Write-Host "[error] BaseUrl is required. Set it via -BaseUrl parameter or TOOL_BASE_URL env var." -ForegroundColor Red; exit 1 }
if ($Name -notmatch '^[a-zA-Z0-9._-]+$') { Write-Host "[error] Name contains invalid characters. Only alphanumeric, dots, hyphens, and underscores are allowed." -ForegroundColor Red; exit 1 }

# Strip trailing slash
$BaseUrl = $BaseUrl.TrimEnd("/")

# -- Output helpers ------------------------------------------------------------
function Write-Info  { param([string]$Msg) Write-Host "[info]  $Msg" -ForegroundColor Cyan }
function Write-Ok    { param([string]$Msg) Write-Host "[ok]    $Msg" -ForegroundColor Green }
function Write-Warn  { param([string]$Msg) Write-Host "[warn]  $Msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$Msg) Write-Host "[error] $Msg" -ForegroundColor Red; exit 1 }

# -- Detect architecture -------------------------------------------------------
function Get-Arch {
    $arch = $env:PROCESSOR_ARCHITECTURE
    switch ($arch) {
        "AMD64" { return "amd64" }
        "ARM64" { return "arm64" }
        default { Write-Err "Unsupported architecture: $arch (only amd64 and arm64 are supported)" }
    }
}

# -- Detect latest version via API ---------------------------------------------
function Get-LatestVersion {
    $apiEndpoint = ""

    if ($ApiUrl) {
        $apiEndpoint = $ApiUrl
    }
    else {
        # Derive GitLab API v4 URL from base URL
        $uri = [System.Uri]$BaseUrl
        $host_ = "$($uri.Scheme)://$($uri.Host)"
        $projectPath = $uri.AbsolutePath.TrimStart("/")
        $encodedPath = $projectPath -replace "/", "%2F"
        $apiEndpoint = "${host_}/api/v4/projects/${encodedPath}/releases?per_page=1"
    }

    Write-Info "Querying latest release from API..."
    Write-Info "  API: $apiEndpoint"

    try {
        $response = Invoke-RestMethod -Uri $apiEndpoint -UseBasicParsing -ErrorAction Stop
    }
    catch {
        Write-Err "Failed to query releases API. Set TOOL_VERSION manually for mirrors without API access.`n  Error: $_"
    }

    if (-not $response -or $response.Count -eq 0) {
        Write-Err "No releases found. Set TOOL_VERSION manually."
    }

    $tagName = ""
    if ($VersionJsonPath) {
        # Convert jq-style path to PowerShell property access
        # e.g., '.[0].tag_name' -> '$response[0].tag_name'
        # e.g., '.tag_name' -> '$response.tag_name'
        $psExpression = $VersionJsonPath -replace '^\.\[', '$response[' -replace '^\.', '$response.'
        if ($psExpression -notmatch '^\$response') { $psExpression = '$response.' + $psExpression }
        try {
            $tagName = Invoke-Expression $psExpression
        }
        catch {
            Write-Err "Failed to evaluate version JSONPath expression '$VersionJsonPath': $_"
        }
    }
    else {
        # Default: auto-detect array vs object
        if ($response -is [array]) {
            $tagName = $response[0].tag_name
        }
        else {
            $tagName = $response.tag_name
        }
    }

    if (-not $tagName) {
        Write-Err "Could not parse version from API response. Set TOOL_VERSION manually."
    }

    # Strip leading 'v'
    return ([string]$tagName).TrimStart("v")
}

# -- Check for existing installation ------------------------------------------
function Test-ExistingInstall {
    $existing = Get-Command $Name -ErrorAction SilentlyContinue
    if ($existing) {
        try {
            $ver = & $Name --version 2>$null
            if ($ver -match '(\d+\.\d+\.\d+)') {
                Write-Warn "$Name $($Matches[1]) is already installed at $($existing.Source)"
            }
        }
        catch {}
    }
}

# -- URL template substitution ------------------------------------------------
function Resolve-UrlTemplate {
    param([string]$Template, [string]$Ver, [string]$Arch, [string]$Ext)
    $result = $Template
    $result = $result -replace '\{base_url\}', $BaseUrl
    $result = $result -replace '\{version\}', $Ver
    $result = $result -replace '\{name\}', $Name
    $result = $result -replace '\{os\}', 'windows'
    $result = $result -replace '\{arch\}', $Arch
    $result = $result -replace '\{ext\}', $Ext
    return $result
}

# -- Main ----------------------------------------------------------------------
function Install-Tool {
    Write-Host ""
    Write-Host "  $Name Installer" -ForegroundColor White
    $separator = "=" * ($Name.Length + 10)
    Write-Host "  $separator" -ForegroundColor White
    Write-Host ""

    $arch = Get-Arch
    Write-Info "Detected OS: Windows, Arch: $arch"
    Write-Info "Base URL: $BaseUrl"

    Test-ExistingInstall

    # Resolve version
    if ($Version) {
        $Version = $Version.TrimStart("v")
        Write-Info "Using pinned version: $Version"
    }
    else {
        $Version = Get-LatestVersion
        Write-Ok "Latest version: $Version"
    }

    # Build filename and download URL
    $ext = "zip"
    if ($DownloadUrl) {
        $downloadEndpoint = Resolve-UrlTemplate -Template $DownloadUrl -Ver $Version -Arch $arch -Ext $ext
        $filename = [System.IO.Path]::GetFileName(($downloadEndpoint -split '\?')[0])
    }
    else {
        # Default GitLab pattern
        $filename = "${Name}_${Version}_windows_${arch}.${ext}"
        $downloadEndpoint = "${BaseUrl}/-/releases/v${Version}/downloads/${filename}"
    }

    Write-Info "Downloading $filename..."
    Write-Info "  URL: $downloadEndpoint"

    # Create temp directory
    $tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) "${Name}-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

    try {
        $zipPath = Join-Path $tmpDir $filename

        # Download
        try {
            Invoke-WebRequest -Uri $downloadEndpoint -OutFile $zipPath -UseBasicParsing -ErrorAction Stop
        }
        catch {
            # Fallback to curl if available (useful in older PS versions)
            $curlExe = Get-Command curl.exe -ErrorAction SilentlyContinue
            if ($curlExe) {
                Write-Info "Retrying with curl.exe..."
                & curl.exe -fsSL $downloadEndpoint -o $zipPath
                if ($LASTEXITCODE -ne 0) {
                    Write-Err "Download failed with both Invoke-WebRequest and curl.exe."
                }
            }
            else {
                Write-Err "Download failed: $_"
            }
        }

        Write-Ok "Download complete"

        # Extract
        Write-Info "Extracting..."
        $extractDir = Join-Path $tmpDir "extracted"
        Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

        # Find the binary
        $toolExe = Get-ChildItem -Path $extractDir -Filter "${Name}.exe" -Recurse | Select-Object -First 1
        if (-not $toolExe) {
            Write-Err "Could not find ${Name}.exe in the extracted archive."
        }

        # Install
        if (-not (Test-Path $InstallDir)) {
            New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        }

        $destPath = Join-Path $InstallDir "${Name}.exe"
        Copy-Item -Path $toolExe.FullName -Destination $destPath -Force
        Write-Ok "Installed ${Name}.exe to $destPath"

        # Check if InstallDir is in PATH
        $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
        if ($userPath -notlike "*$InstallDir*") {
            Write-Host ""
            Write-Warn "$InstallDir is not in your PATH."
            Write-Host ""

            $addToPath = $true
            # Only prompt if running interactively (not piped)
            if ([Environment]::UserInteractive -and -not $env:TOOL_NONINTERACTIVE) {
                $answer = Read-Host "  Add it to your user PATH? [Y/n]"
                if ($answer -and $answer.ToLower() -ne "y") {
                    $addToPath = $false
                }
            }

            if ($addToPath) {
                $newPath = "$InstallDir;$userPath"
                [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
                $env:PATH = "$InstallDir;$env:PATH"
                Write-Ok "Added $InstallDir to user PATH"
                Write-Info "Restart your terminal for PATH changes to take effect in new sessions."
            }
            else {
                Write-Host "  Add it manually:"
                Write-Host ""
                Write-Host "    [Environment]::SetEnvironmentVariable('PATH', `"$InstallDir;`$env:PATH`", 'User')"
                Write-Host ""
            }
        }

        # Verify
        try {
            $verOutput = & $destPath --version 2>$null
            if ($verOutput -match '(\d+\.\d+\.\d+)') {
                Write-Host ""
                Write-Ok "$Name $($Matches[1]) is ready!"
                Write-Host ""
                Write-Host "  Get started:"
                Write-Host "    $Name --version"
                Write-Host "    $Name --help"
                Write-Host ""
            }
        }
        catch {
            Write-Warn "Installation may have completed but could not verify. Try running: $destPath --version"
        }
    }
    finally {
        # Clean up temp directory
        Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Install-Tool
