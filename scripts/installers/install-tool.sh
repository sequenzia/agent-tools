#!/usr/bin/env bash
# install-tool.sh - Install a tool from pre-built binaries
#
# Usage:
#   curl -fsSL https://example.com/install-tool.sh | TOOL_NAME=mytool TOOL_BASE_URL=https://gitlab.com/myorg/mytool bash
#   bash install-tool.sh --name mytool --base-url https://gitlab.com/myorg/mytool
#   bash install-tool.sh --name mytool --base-url https://gitlab.com/myorg/mytool --version 1.2.0
#   bash install-tool.sh --name mytool --base-url https://github.com/myorg/mytool \
#     --download-url '{base_url}/releases/download/v{version}/{name}_{version}_{os}_{arch}.{ext}' \
#     --api-url 'https://api.github.com/repos/myorg/mytool/releases/latest' \
#     --version-jsonpath '.tag_name'
#
# Required environment variables (or CLI flags):
#   TOOL_NAME       - Binary name (e.g., glab, myctl)
#   TOOL_BASE_URL   - Base project URL (e.g., https://gitlab.com/gitlab-org/cli)
#
# Optional environment variables:
#   TOOL_VERSION          - Pin a specific version (default: auto-detect latest)
#   TOOL_INSTALL_DIR      - Override install directory (default: ~/.local/bin)
#   TOOL_DOWNLOAD_URL     - Download URL template with placeholders (default: GitLab pattern)
#   TOOL_API_URL          - Full API URL for version detection (default: derived from base URL)
#   TOOL_VERSION_JSONPATH - jq-style expression to extract version (default: auto-detect)
#
# URL template placeholders:
#   {base_url} {version} {name} {os} {arch} {ext}
#
# Default download URL pattern (GitLab):
#   {base_url}/-/releases/v{version}/downloads/{name}_{version}_{os}_{arch}.{ext}

set -euo pipefail

# -- Defaults ------------------------------------------------------------------
DEFAULT_INSTALL_DIR="${HOME}/.local/bin"

# -- Colors (disabled if not a terminal) ---------------------------------------
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    RESET='\033[0m'
else
    RED='' GREEN='' YELLOW='' CYAN='' BOLD='' RESET=''
fi

info()  { printf "${CYAN}[info]${RESET}  %s\n" "$*"; }
ok()    { printf "${GREEN}[ok]${RESET}    %s\n" "$*"; }
warn()  { printf "${YELLOW}[warn]${RESET}  %s\n" "$*"; }
error() { printf "${RED}[error]${RESET} %s\n" "$*" >&2; exit 1; }

# -- Parse CLI arguments (override env vars) -----------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --name)             TOOL_NAME="$2"; shift 2 ;;
        --base-url)         TOOL_BASE_URL="$2"; shift 2 ;;
        --version)          TOOL_VERSION="$2"; shift 2 ;;
        --install-dir)      TOOL_INSTALL_DIR="$2"; shift 2 ;;
        --download-url)     TOOL_DOWNLOAD_URL="$2"; shift 2 ;;
        --api-url)          TOOL_API_URL="$2"; shift 2 ;;
        --version-jsonpath) TOOL_VERSION_JSONPATH="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: install-tool.sh [OPTIONS]"
            echo ""
            echo "Required:"
            echo "  --name NAME          Binary name (e.g., glab, myctl)"
            echo "  --base-url URL       Project URL (e.g., https://gitlab.com/gitlab-org/cli)"
            echo ""
            echo "Optional:"
            echo "  --version VER        Pin a specific version (default: auto-detect latest)"
            echo "  --install-dir DIR    Installation directory (default: $DEFAULT_INSTALL_DIR)"
            echo "  --download-url TPL   Download URL template with {base_url}, {version}, {name},"
            echo "                       {os}, {arch}, {ext} placeholders"
            echo "  --api-url URL        Full API URL for version detection"
            echo "  --version-jsonpath X jq-style expression to extract version from API response"
            echo "  -h, --help           Show this help"
            echo ""
            echo "Environment variables:"
            echo "  TOOL_NAME, TOOL_BASE_URL, TOOL_VERSION, TOOL_INSTALL_DIR,"
            echo "  TOOL_DOWNLOAD_URL, TOOL_API_URL, TOOL_VERSION_JSONPATH"
            exit 0
            ;;
        *) error "Unknown option: $1 (use --help for usage)" ;;
    esac
done

# -- Resolve parameters --------------------------------------------------------
TOOL_NAME="${TOOL_NAME:-}"
BASE_URL="${TOOL_BASE_URL:-}"
INSTALL_DIR="${TOOL_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
DOWNLOAD_URL_TEMPLATE="${TOOL_DOWNLOAD_URL:-}"
API_URL_OVERRIDE="${TOOL_API_URL:-}"
VERSION_JSONPATH="${TOOL_VERSION_JSONPATH:-}"

# Strip trailing slash from base URL
BASE_URL="${BASE_URL%/}"

# -- Validate required parameters ----------------------------------------------
if [ -z "$TOOL_NAME" ]; then
    error "TOOL_NAME is required. Set it via --name or TOOL_NAME env var."
fi
if [ -z "$BASE_URL" ]; then
    error "TOOL_BASE_URL is required. Set it via --base-url or TOOL_BASE_URL env var."
fi
if [[ ! "$TOOL_NAME" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    error "TOOL_NAME contains invalid characters. Only alphanumeric, dots, hyphens, and underscores are allowed."
fi

# -- Detect OS -----------------------------------------------------------------
detect_os() {
    local uname_out
    uname_out="$(uname -s)"
    case "$uname_out" in
        Linux*)  echo "linux" ;;
        Darwin*) echo "darwin" ;;
        MINGW*|MSYS*|CYGWIN*) error "This script is for Linux/macOS. Use install-tool.ps1 or install-tool.cmd on Windows." ;;
        *) error "Unsupported OS: $uname_out" ;;
    esac
}

# -- Detect architecture -------------------------------------------------------
detect_arch() {
    local machine
    machine="$(uname -m)"
    case "$machine" in
        x86_64|amd64)   echo "amd64" ;;
        aarch64|arm64)  echo "arm64" ;;
        *) error "Unsupported architecture: $machine (only amd64 and arm64 are supported)" ;;
    esac
}

# -- Detect latest version via API ---------------------------------------------
# Sets DETECTED_VERSION as a global variable (avoids subshell stdout issues)
detect_latest_version() {
    local api_url version

    if [ -n "$API_URL_OVERRIDE" ]; then
        api_url="$API_URL_OVERRIDE"
    else
        # Derive GitLab API v4 URL from base URL
        local host project_path encoded_path
        host="$(echo "$BASE_URL" | grep -oP '^https?://[^/]+')"
        project_path="$(echo "$BASE_URL" | sed "s|${host}/||")"
        encoded_path="$(printf '%s' "$project_path" | sed 's|/|%2F|g')"
        api_url="${host}/api/v4/projects/${encoded_path}/releases?per_page=1"
    fi

    info "Querying latest release from API..."
    info "  API: $api_url"

    local response
    if command -v curl &>/dev/null; then
        response="$(curl -fsSL "$api_url" 2>/dev/null)" || true
    elif command -v wget &>/dev/null; then
        response="$(wget -qO- "$api_url" 2>/dev/null)" || true
    else
        error "Neither curl nor wget found. Install one of them or set TOOL_VERSION manually."
    fi

    if [ -z "$response" ]; then
        error "Failed to query releases API. Set TOOL_VERSION manually for mirrors without API access."
    fi

    # Parse version from JSON response
    if [ -n "$VERSION_JSONPATH" ]; then
        # User-provided jq expression
        if command -v jq &>/dev/null; then
            version="$(echo "$response" | jq -r "$VERSION_JSONPATH // empty")"
        elif command -v python3 &>/dev/null; then
            version="$(echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
path = '''$VERSION_JSONPATH'''
if path.startswith('.'):
    path = path[1:]
parts = []
current = ''
for ch in path:
    if ch == '[':
        if current:
            parts.append(current)
            current = ''
    elif ch == ']':
        parts.append(int(current))
        current = ''
    elif ch == '.':
        if current:
            parts.append(current)
            current = ''
    else:
        current += ch
if current:
    parts.append(current)
result = data
for part in parts:
    if isinstance(part, int):
        result = result[part]
    else:
        result = result[part]
v = str(result) if result else ''
print(v)
" 2>/dev/null)" || true
        else
            error "TOOL_VERSION_JSONPATH requires jq or python3. Install one or set TOOL_VERSION manually."
        fi
    else
        # Default: auto-detect array vs object, extract tag_name
        if command -v jq &>/dev/null; then
            version="$(echo "$response" | jq -r 'if type == "array" then .[0].tag_name else .tag_name end // empty')"
        elif command -v python3 &>/dev/null; then
            version="$(echo "$response" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if isinstance(d, list):
    print(d[0]['tag_name'] if d else '')
else:
    print(d.get('tag_name', ''))
" 2>/dev/null)" || true
        else
            # Fallback: grep for tag_name
            version="$(echo "$response" | grep -oP '"tag_name"\s*:\s*"v?\K[^"]+' | head -1)"
            if [ -n "$version" ]; then
                version="v${version}"
            fi
        fi
    fi

    if [ -z "$version" ]; then
        error "Could not parse latest version from API response. Set TOOL_VERSION manually."
    fi

    # Strip the leading 'v' if present, we add it back where needed
    DETECTED_VERSION="${version#v}"
}

# -- Check for existing installation ------------------------------------------
check_existing() {
    if command -v "$TOOL_NAME" &>/dev/null; then
        local current_version
        current_version="$("$TOOL_NAME" --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1)" || true
        if [ -n "$current_version" ]; then
            warn "$TOOL_NAME $current_version is already installed at $(command -v "$TOOL_NAME")"
        fi
    fi
}

# -- Download helper -----------------------------------------------------------
download() {
    local url="$1" dest="$2"
    if command -v curl &>/dev/null; then
        curl -fsSL "$url" -o "$dest"
    elif command -v wget &>/dev/null; then
        wget -qO "$dest" "$url"
    else
        error "Neither curl nor wget found."
    fi
}

# -- URL template substitution -------------------------------------------------
resolve_template() {
    local template="$1" version="$2" os="$3" arch="$4" ext="$5"
    local result="$template"
    result="${result//\{base_url\}/$BASE_URL}"
    result="${result//\{version\}/$version}"
    result="${result//\{name\}/$TOOL_NAME}"
    result="${result//\{os\}/$os}"
    result="${result//\{arch\}/$arch}"
    result="${result//\{ext\}/$ext}"
    echo "$result"
}

# -- Main ----------------------------------------------------------------------
TMPDIR_CLEANUP=""

cleanup() {
    if [ -n "$TMPDIR_CLEANUP" ] && [ -d "$TMPDIR_CLEANUP" ]; then
        rm -rf "$TMPDIR_CLEANUP"
    fi
}
trap cleanup EXIT

main() {
    echo ""
    printf "${BOLD}  %s Installer${RESET}\n" "$TOOL_NAME"
    printf "  %s\n" "$(printf '=%.0s' $(seq 1 $((${#TOOL_NAME} + 10))))"
    echo ""

    local os arch version filename download_url

    os="$(detect_os)"
    arch="$(detect_arch)"

    info "Detected OS: $os, Arch: $arch"
    info "Base URL: $BASE_URL"

    check_existing

    # Resolve version
    if [ -n "${TOOL_VERSION:-}" ]; then
        version="${TOOL_VERSION#v}"
        info "Using pinned version: $version"
    else
        detect_latest_version
        version="$DETECTED_VERSION"
        ok "Latest version: $version"
    fi

    # Build filename and download URL
    local ext="tar.gz"
    if [ -n "$DOWNLOAD_URL_TEMPLATE" ]; then
        download_url="$(resolve_template "$DOWNLOAD_URL_TEMPLATE" "$version" "$os" "$arch" "$ext")"
        filename="$(basename "${download_url%%\?*}")"
    else
        # Default GitLab pattern
        filename="${TOOL_NAME}_${version}_${os}_${arch}.${ext}"
        download_url="${BASE_URL}/-/releases/v${version}/downloads/${filename}"
    fi

    info "Downloading $filename..."
    info "  URL: $download_url"

    # Create temp directory for download and extraction
    TMPDIR_CLEANUP="$(mktemp -d)"
    local tmpdir="$TMPDIR_CLEANUP"

    download "$download_url" "${tmpdir}/${filename}"
    ok "Download complete"

    # Extract
    info "Extracting..."
    tar -xzf "${tmpdir}/${filename}" -C "$tmpdir"

    # Find the binary (it may be in a bin/ subdirectory or at the root)
    local tool_bin=""
    if [ -f "${tmpdir}/bin/${TOOL_NAME}" ]; then
        tool_bin="${tmpdir}/bin/${TOOL_NAME}"
    elif [ -f "${tmpdir}/${TOOL_NAME}" ]; then
        tool_bin="${tmpdir}/${TOOL_NAME}"
    else
        # Search for it
        tool_bin="$(find "$tmpdir" -name "$TOOL_NAME" -type f | head -1)"
    fi

    if [ -z "$tool_bin" ] || [ ! -f "$tool_bin" ]; then
        error "Could not find $TOOL_NAME binary in the extracted archive."
    fi

    # Install
    mkdir -p "$INSTALL_DIR"
    chmod +x "$tool_bin"
    mv "$tool_bin" "${INSTALL_DIR}/${TOOL_NAME}"
    ok "Installed $TOOL_NAME to ${INSTALL_DIR}/${TOOL_NAME}"

    # Check if INSTALL_DIR is in PATH
    if ! echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
        echo ""
        warn "${INSTALL_DIR} is not in your PATH."
        echo ""
        echo "  Add it by appending one of these to your shell config:"
        echo ""
        echo "    # For bash (~/.bashrc):"
        echo "    export PATH=\"${INSTALL_DIR}:\$PATH\""
        echo ""
        echo "    # For zsh (~/.zshrc):"
        echo "    export PATH=\"${INSTALL_DIR}:\$PATH\""
        echo ""
        echo "    # For fish (~/.config/fish/config.fish):"
        echo "    fish_add_path ${INSTALL_DIR}"
        echo ""
    fi

    # Verify installation
    if "${INSTALL_DIR}/${TOOL_NAME}" --version &>/dev/null; then
        local installed_version
        installed_version="$("${INSTALL_DIR}/${TOOL_NAME}" --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1)"
        echo ""
        ok "$TOOL_NAME ${installed_version} is ready!"
        echo ""
        echo "  Get started:"
        echo "    ${TOOL_NAME} --version"
        echo "    ${TOOL_NAME} --help"
        echo ""
    else
        warn "Installation may have completed but could not verify. Try running: ${INSTALL_DIR}/${TOOL_NAME} --version"
    fi
}

main
