@echo off
setlocal enabledelayedexpansion

:: install-tool.cmd - Install a tool from pre-built binaries
::
:: Usage:
::   set TOOL_NAME=mytool && set TOOL_BASE_URL=https://gitlab.com/myorg/mytool && install-tool.cmd
::   install-tool.cmd --name mytool --base-url https://gitlab.com/myorg/mytool
::   install-tool.cmd --name mytool --base-url https://gitlab.com/myorg/mytool --version 1.2.0
::   install-tool.cmd --name mytool --base-url https://github.com/myorg/mytool ^
::     --download-url "{base_url}/releases/download/v{version}/{name}_{version}_{os}_{arch}.{ext}" ^
::     --api-url "https://api.github.com/repos/myorg/mytool/releases/latest" ^
::     --version-jsonpath ".tag_name"
::
:: Required environment variables (or CLI flags):
::   TOOL_NAME       - Binary name (e.g., glab, myctl)
::   TOOL_BASE_URL   - Base project URL (e.g., https://gitlab.com/gitlab-org/cli)
::
:: Optional environment variables:
::   TOOL_VERSION          - Pin a specific version (default: auto-detect latest)
::   TOOL_INSTALL_DIR      - Override install directory (default: %USERPROFILE%\.local\bin)
::   TOOL_DOWNLOAD_URL     - Download URL template with placeholders (default: GitLab pattern)
::   TOOL_API_URL          - Full API URL for version detection (default: derived from base URL)
::   TOOL_VERSION_JSONPATH - jq-style expression to extract version (default: auto-detect)
::
:: URL template placeholders:
::   {base_url} {version} {name} {os} {arch} {ext}
::
:: Requirements: Windows 10+ (ships with curl.exe and tar)

:: -- Defaults -----------------------------------------------------------------
if not defined TOOL_INSTALL_DIR set "TOOL_INSTALL_DIR=%USERPROFILE%\.local\bin"

:: -- Parse CLI arguments ------------------------------------------------------
:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="--name"             ( set "TOOL_NAME=%~2"             & shift & shift & goto :parse_args )
if /i "%~1"=="--base-url"        ( set "TOOL_BASE_URL=%~2"         & shift & shift & goto :parse_args )
if /i "%~1"=="--version"         ( set "TOOL_VERSION=%~2"          & shift & shift & goto :parse_args )
if /i "%~1"=="--install-dir"     ( set "TOOL_INSTALL_DIR=%~2"      & shift & shift & goto :parse_args )
if /i "%~1"=="--download-url"    ( set "TOOL_DOWNLOAD_URL=%~2"     & shift & shift & goto :parse_args )
if /i "%~1"=="--api-url"         ( set "TOOL_API_URL=%~2"          & shift & shift & goto :parse_args )
if /i "%~1"=="--version-jsonpath" ( set "TOOL_VERSION_JSONPATH=%~2" & shift & shift & goto :parse_args )
if /i "%~1"=="--help" goto :show_help
if /i "%~1"=="-h"     goto :show_help
echo [error] Unknown option: %~1
echo         Use --help for usage.
exit /b 1
:args_done

:: -- Validate required parameters ---------------------------------------------
if not defined TOOL_NAME (
    echo [error] TOOL_NAME is required. Set it via --name or TOOL_NAME env var.
    exit /b 1
)
if not defined TOOL_BASE_URL (
    echo [error] TOOL_BASE_URL is required. Set it via --base-url or TOOL_BASE_URL env var.
    exit /b 1
)

:: Validate TOOL_NAME characters (alphanumeric, dots, hyphens, underscores only)
echo !TOOL_NAME! | findstr /r "^[a-zA-Z0-9._-]*$" >nul 2>&1
if errorlevel 1 (
    echo [error] TOOL_NAME contains invalid characters. Only alphanumeric, dots, hyphens, and underscores are allowed.
    exit /b 1
)

:: Strip trailing slash from base URL
if "!TOOL_BASE_URL:~-1!"=="/" set "TOOL_BASE_URL=!TOOL_BASE_URL:~0,-1!"

echo.
echo   !TOOL_NAME! Installer
echo   ===================
echo.

:: -- Check for curl.exe -------------------------------------------------------
where curl.exe >nul 2>&1
if errorlevel 1 (
    echo [error] curl.exe not found. This script requires Windows 10 or later.
    exit /b 1
)

:: -- Detect architecture ------------------------------------------------------
set "ARCH="
if /i "%PROCESSOR_ARCHITECTURE%"=="AMD64" set "ARCH=amd64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=arm64"
if not defined ARCH (
    echo [error] Unsupported architecture: %PROCESSOR_ARCHITECTURE% ^(only amd64 and arm64 are supported^)
    exit /b 1
)

echo [info]  Detected OS: Windows, Arch: %ARCH%
echo [info]  Base URL: !TOOL_BASE_URL!

:: -- Check for existing installation ------------------------------------------
where !TOOL_NAME!.exe >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%v in ('!TOOL_NAME! --version 2^>nul') do (
        echo [warn]  !TOOL_NAME! is already installed: %%v
    )
)

:: -- Resolve version ----------------------------------------------------------
if defined TOOL_VERSION (
    :: Strip leading 'v' if present
    set "VER=!TOOL_VERSION!"
    if "!VER:~0,1!"=="v" set "VER=!VER:~1!"
    echo [info]  Using pinned version: !VER!
    goto :version_resolved
)

:: Auto-detect latest version via API
if defined TOOL_API_URL (
    set "API_URL=!TOOL_API_URL!"
    goto :api_url_ready
)

:: Derive GitLab API v4 URL from base URL
set "URL_REMAINDER=!TOOL_BASE_URL!"

:: Parse scheme
for /f "tokens=1,2 delims=/" %%a in ("!URL_REMAINDER!") do (
    set "SCHEME=%%a"
)

:: Remove scheme:// to get host/path
set "URL_NO_SCHEME=!URL_REMAINDER:*//=!"

:: Split into host and project path
for /f "tokens=1,* delims=/" %%a in ("!URL_NO_SCHEME!") do (
    set "API_HOST=%%a"
    set "PROJECT_PATH=%%b"
)

:: URL-encode the project path (replace / with %%2F)
set "ENCODED_PATH=!PROJECT_PATH:/=%%2F!"

set "API_URL=!SCHEME!//!API_HOST!/api/v4/projects/!ENCODED_PATH!/releases?per_page=1"

:api_url_ready
echo [info]  Querying latest release from API...
echo [info]    API: !API_URL!

:: Download API response to temp file
set "API_TEMP=%TEMP%\tool-api-%RANDOM%.json"
curl.exe -fsSL "!API_URL!" -o "!API_TEMP!" 2>nul
if errorlevel 1 (
    echo [error] Failed to query releases API.
    echo         Set TOOL_VERSION manually for mirrors without API access.
    if exist "!API_TEMP!" del /q "!API_TEMP!"
    exit /b 1
)

:: Parse version from JSON using PowerShell (available on all modern Windows)
if defined TOOL_VERSION_JSONPATH (
    :: Convert jq-style path to PowerShell property access
    for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "try { $r = Get-Content '%API_TEMP%' -Raw | ConvertFrom-Json; $expr = '%TOOL_VERSION_JSONPATH%' -replace '^\.\[', '$r[' -replace '^\.', '$r.'; if ($expr -notmatch '^\$r') { $expr = '$r.' + $expr }; $t = Invoke-Expression $expr; if ($t) { ([string]$t).TrimStart('v') } else { '' } } catch { '' }"`) do (
        set "VER=%%v"
    )
) else (
    :: Default: auto-detect array vs object, extract tag_name
    for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "try { $r = Get-Content '%API_TEMP%' -Raw | ConvertFrom-Json; if ($r -is [array]) { $t = $r[0].tag_name } else { $t = $r.tag_name }; if ($t) { $t.TrimStart('v') } else { '' } } catch { '' }"`) do (
        set "VER=%%v"
    )
)

if exist "!API_TEMP!" del /q "!API_TEMP!"

if not defined VER (
    echo [error] Could not determine latest version. Set TOOL_VERSION manually.
    exit /b 1
)
if "!VER!"=="" (
    echo [error] Could not determine latest version. Set TOOL_VERSION manually.
    exit /b 1
)

echo [ok]    Latest version: !VER!

:version_resolved

:: -- Build download URL -------------------------------------------------------
set "EXT=zip"
if defined TOOL_DOWNLOAD_URL (
    :: Substitute placeholders in the download URL template
    :: NOTE: 'call set' with %%VAR%% is needed because delayed expansion
    :: cannot nest !var! inside !var:old=new! substitution syntax.
    set "DOWNLOAD_URL=!TOOL_DOWNLOAD_URL!"
    call set "DOWNLOAD_URL=%%DOWNLOAD_URL:{base_url}=!TOOL_BASE_URL!%%"
    call set "DOWNLOAD_URL=%%DOWNLOAD_URL:{version}=!VER!%%"
    call set "DOWNLOAD_URL=%%DOWNLOAD_URL:{name}=!TOOL_NAME!%%"
    call set "DOWNLOAD_URL=%%DOWNLOAD_URL:{os}=windows%%"
    call set "DOWNLOAD_URL=%%DOWNLOAD_URL:{arch}=!ARCH!%%"
    call set "DOWNLOAD_URL=%%DOWNLOAD_URL:{ext}=!EXT!%%"
    :: Extract filename from URL (everything after last /)
    for %%F in ("!DOWNLOAD_URL!") do set "FILENAME=%%~nxF"
) else (
    :: Default GitLab pattern
    set "FILENAME=!TOOL_NAME!_!VER!_windows_!ARCH!.!EXT!"
    set "DOWNLOAD_URL=!TOOL_BASE_URL!/-/releases/v!VER!/downloads/!FILENAME!"
)

echo [info]  Downloading !FILENAME!...
echo [info]    URL: !DOWNLOAD_URL!

:: -- Create temp directory ----------------------------------------------------
set "TMPDIR=%TEMP%\!TOOL_NAME!-install-%RANDOM%"
mkdir "!TMPDIR!" 2>nul

set "ZIP_PATH=!TMPDIR!\!FILENAME!"
set "EXTRACT_DIR=!TMPDIR!\extracted"

:: -- Download -----------------------------------------------------------------
curl.exe -fsSL "!DOWNLOAD_URL!" -o "!ZIP_PATH!"
if errorlevel 1 (
    echo [error] Download failed. Check the URL and version.
    rd /s /q "!TMPDIR!" 2>nul
    exit /b 1
)
echo [ok]    Download complete

:: -- Extract ------------------------------------------------------------------
echo [info]  Extracting...
mkdir "!EXTRACT_DIR!" 2>nul

:: Try tar first (available on Windows 10 1803+), fall back to PowerShell
tar -xf "!ZIP_PATH!" -C "!EXTRACT_DIR!" 2>nul
if errorlevel 1 (
    powershell -NoProfile -Command "Expand-Archive -Path '!ZIP_PATH!' -DestinationPath '!EXTRACT_DIR!' -Force" 2>nul
    if errorlevel 1 (
        echo [error] Failed to extract archive. Ensure tar or PowerShell is available.
        rd /s /q "!TMPDIR!" 2>nul
        exit /b 1
    )
)

:: -- Find the binary ----------------------------------------------------------
set "TOOL_BIN="
if exist "!EXTRACT_DIR!\bin\!TOOL_NAME!.exe" set "TOOL_BIN=!EXTRACT_DIR!\bin\!TOOL_NAME!.exe"
if not defined TOOL_BIN if exist "!EXTRACT_DIR!\!TOOL_NAME!.exe" set "TOOL_BIN=!EXTRACT_DIR!\!TOOL_NAME!.exe"
if not defined TOOL_BIN (
    :: Search recursively
    for /r "!EXTRACT_DIR!" %%f in (!TOOL_NAME!.exe) do (
        if not defined TOOL_BIN set "TOOL_BIN=%%f"
    )
)

if not defined TOOL_BIN (
    echo [error] Could not find !TOOL_NAME!.exe in the extracted archive.
    rd /s /q "!TMPDIR!" 2>nul
    exit /b 1
)

:: -- Install ------------------------------------------------------------------
if not exist "!TOOL_INSTALL_DIR!" mkdir "!TOOL_INSTALL_DIR!"

set "DEST_PATH=!TOOL_INSTALL_DIR!\!TOOL_NAME!.exe"
copy /y "!TOOL_BIN!" "!DEST_PATH!" >nul
echo [ok]    Installed !TOOL_NAME!.exe to !DEST_PATH!

:: -- Clean up temp files ------------------------------------------------------
rd /s /q "!TMPDIR!" 2>nul

:: -- Check PATH ---------------------------------------------------------------
echo !PATH! | find /i "!TOOL_INSTALL_DIR!" >nul 2>&1
if errorlevel 1 (
    echo.
    echo [warn]  !TOOL_INSTALL_DIR! is not in your PATH.
    echo.

    :: Add to user PATH
    for /f "usebackq tokens=*" %%p in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('PATH', 'User')"`) do (
        set "USER_PATH=%%p"
    )

    set /p "ADD_PATH=  Add it to your user PATH? [Y/n] "
    if /i "!ADD_PATH!"=="" set "ADD_PATH=Y"
    if /i "!ADD_PATH!"=="Y" (
        powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('PATH', '!TOOL_INSTALL_DIR!;!USER_PATH!', 'User')"
        set "PATH=!TOOL_INSTALL_DIR!;!PATH!"
        echo [ok]    Added !TOOL_INSTALL_DIR! to user PATH
        echo [info]  Restart your terminal for PATH changes to take effect in new sessions.
    ) else (
        echo.
        echo   Add it manually by running:
        echo.
        echo     setx PATH "!TOOL_INSTALL_DIR!;%%PATH%%"
        echo.
    )
)

:: -- Verify -------------------------------------------------------------------
"!DEST_PATH!" --version >nul 2>&1
if not errorlevel 1 (
    echo.
    for /f "tokens=*" %%v in ('"!DEST_PATH!" --version 2^>nul') do (
        echo [ok]    %%v is ready!
    )
    echo.
    echo   Get started:
    echo     !TOOL_NAME! --version
    echo     !TOOL_NAME! --help
    echo.
) else (
    echo [warn]  Installation may have completed but could not verify.
    echo         Try running: "!DEST_PATH!" --version
)

exit /b 0

:: -- Help ---------------------------------------------------------------------
:show_help
echo Usage: install-tool.cmd [OPTIONS]
echo.
echo Required:
echo   --name NAME          Binary name (e.g., glab, myctl)
echo   --base-url URL       Project URL (e.g., https://gitlab.com/gitlab-org/cli)
echo.
echo Optional:
echo   --version VER        Pin a specific version (default: auto-detect latest)
echo   --install-dir DIR    Installation directory
echo                        (default: %%USERPROFILE%%\.local\bin)
echo   --download-url TPL   Download URL template with {base_url}, {version}, {name},
echo                        {os}, {arch}, {ext} placeholders
echo   --api-url URL        Full API URL for version detection
echo   --version-jsonpath X jq-style expression to extract version from API response
echo   -h, --help           Show this help
echo.
echo Environment variables:
echo   TOOL_NAME, TOOL_BASE_URL, TOOL_VERSION, TOOL_INSTALL_DIR,
echo   TOOL_DOWNLOAD_URL, TOOL_API_URL, TOOL_VERSION_JSONPATH
exit /b 0
