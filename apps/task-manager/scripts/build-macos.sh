#!/usr/bin/env bash
#
# Build script for macOS distributable artifacts (.app + .dmg)
#
# Usage:
#   ./scripts/build-macos.sh                  # Build for current architecture
#   ./scripts/build-macos.sh --target aarch64 # Build for Apple Silicon (arm64)
#   ./scripts/build-macos.sh --target x86_64  # Build for Intel
#   ./scripts/build-macos.sh --target universal # Universal binary (both archs)
#   ./scripts/build-macos.sh --verbose        # Enable verbose output
#   ./scripts/build-macos.sh --skip-frontend  # Skip frontend build (use existing dist/)
#
# Environment variables for code signing (optional):
#   APPLE_SIGNING_IDENTITY  - Code signing identity (e.g., "Developer ID Application: Name (TEAMID)")
#   APPLE_CERTIFICATE       - Base64-encoded .p12 certificate
#   APPLE_CERTIFICATE_PASSWORD - Password for the .p12 certificate
#   APPLE_API_KEY           - App Store Connect API key for notarization
#   APPLE_API_ISSUER        - App Store Connect API issuer ID
#   APPLE_API_KEY_PATH      - Path to the .p8 API key file
#
# Output:
#   src-tauri/target/release/bundle/dmg/*.dmg
#   src-tauri/target/release/bundle/macos/*.app

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
TARGET=""
VERBOSE=""
SKIP_FRONTEND=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --target)
            TARGET="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE="--verbose"
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --help|-h)
            head -24 "$0" | tail -21
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option '$1'${NC}" >&2
            echo "Run '$0 --help' for usage information." >&2
            exit 1
            ;;
    esac
done

log_step() {
    echo -e "${BLUE}==>${NC} $1"
}

log_success() {
    echo -e "${GREEN}==>${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

log_error() {
    echo -e "${RED}Error:${NC} $1" >&2
}

# Resolve Rust target triple from shorthand
resolve_target() {
    case "${1:-}" in
        aarch64|arm64)
            echo "aarch64-apple-darwin"
            ;;
        x86_64|intel)
            echo "x86_64-apple-darwin"
            ;;
        universal)
            echo "universal-apple-darwin"
            ;;
        "")
            echo ""
            ;;
        *)
            # Accept full target triple as-is
            echo "$1"
            ;;
    esac
}

cd "$PROJECT_DIR"

log_step "Task Manager macOS Build"
echo "    Project: $PROJECT_DIR"
echo "    Version: $(grep '"version"' package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')"

# Check prerequisites
log_step "Checking prerequisites..."

if ! command -v node &>/dev/null; then
    log_error "Node.js is not installed. Install it from https://nodejs.org/"
    exit 1
fi

if ! command -v npm &>/dev/null; then
    log_error "npm is not installed."
    exit 1
fi

CARGO_BIN="${HOME}/.cargo/bin/cargo"
if [[ ! -x "$CARGO_BIN" ]]; then
    if command -v cargo &>/dev/null; then
        CARGO_BIN="cargo"
    else
        log_error "Rust/Cargo is not installed. Install it from https://rustup.rs/"
        exit 1
    fi
fi

# Check for Xcode Command Line Tools (required for macOS builds)
if ! xcode-select -p &>/dev/null; then
    log_error "Xcode Command Line Tools not installed. Run: xcode-select --install"
    exit 1
fi

echo "    Node: $(node --version)"
echo "    npm: $(npm --version)"
echo "    Cargo: $($CARGO_BIN --version)"
echo "    Arch: $(uname -m)"

# Resolve target
RUST_TARGET=$(resolve_target "$TARGET")
if [[ -n "$RUST_TARGET" ]]; then
    log_step "Target architecture: $RUST_TARGET"

    # Ensure the Rust target is installed
    if ! rustup target list --installed 2>/dev/null | grep -q "$RUST_TARGET"; then
        if [[ "$RUST_TARGET" == "universal-apple-darwin" ]]; then
            # Universal requires both targets
            for t in aarch64-apple-darwin x86_64-apple-darwin; do
                if ! rustup target list --installed 2>/dev/null | grep -q "$t"; then
                    log_step "Installing Rust target: $t"
                    rustup target add "$t"
                fi
            done
        else
            log_step "Installing Rust target: $RUST_TARGET"
            rustup target add "$RUST_TARGET"
        fi
    fi
fi

# Install npm dependencies if needed
if [[ ! -d "node_modules" ]]; then
    log_step "Installing npm dependencies..."
    npm install
fi

# Check code signing setup
if [[ -n "${APPLE_SIGNING_IDENTITY:-}" ]]; then
    log_step "Code signing enabled: $APPLE_SIGNING_IDENTITY"
    export APPLE_SIGNING_IDENTITY
else
    log_warn "No APPLE_SIGNING_IDENTITY set. Building without code signing."
    log_warn "The app will show a security warning on first launch."
    log_warn "Set APPLE_SIGNING_IDENTITY to enable signing."
fi

# Build frontend first if not skipping
if [[ "$SKIP_FRONTEND" == false ]]; then
    log_step "Building frontend..."
    npm run build
    if [[ ! -d "dist" ]]; then
        log_error "Frontend build failed: dist/ directory not created"
        exit 1
    fi
    log_success "Frontend built successfully"
else
    if [[ ! -d "dist" ]]; then
        log_error "Cannot skip frontend build: dist/ directory does not exist"
        exit 1
    fi
    log_warn "Skipping frontend build (using existing dist/)"
fi

# Build Tauri app
log_step "Building Tauri application..."

BUILD_ARGS=("build")
if [[ -n "$RUST_TARGET" ]]; then
    BUILD_ARGS+=("--target" "$RUST_TARGET")
fi
if [[ -n "$VERBOSE" ]]; then
    BUILD_ARGS+=("$VERBOSE")
fi
# Skip the frontend build since we already did it (or skipped it)
BUILD_ARGS+=("--no-bundle")

npx tauri "${BUILD_ARGS[@]}"

# Now bundle separately
log_step "Creating macOS bundles (.app + .dmg)..."

BUNDLE_ARGS=("bundle")
if [[ -n "$RUST_TARGET" ]]; then
    BUNDLE_ARGS+=("--target" "$RUST_TARGET")
fi
if [[ -n "$VERBOSE" ]]; then
    BUNDLE_ARGS+=("$VERBOSE")
fi

npx tauri "${BUNDLE_ARGS[@]}"

# Locate output artifacts
if [[ -n "$RUST_TARGET" ]]; then
    BUNDLE_DIR="src-tauri/target/${RUST_TARGET}/release/bundle"
else
    BUNDLE_DIR="src-tauri/target/release/bundle"
fi

log_step "Build artifacts:"

# Find .app bundle
APP_PATH=$(find "$BUNDLE_DIR/macos" -name "*.app" -maxdepth 1 2>/dev/null | head -1)
if [[ -n "$APP_PATH" ]]; then
    APP_SIZE=$(du -sh "$APP_PATH" | cut -f1)
    log_success ".app bundle: $APP_PATH ($APP_SIZE)"
else
    log_error "No .app bundle found in $BUNDLE_DIR/macos/"
    exit 1
fi

# Find .dmg installer
DMG_PATH=$(find "$BUNDLE_DIR/dmg" -name "*.dmg" -maxdepth 1 2>/dev/null | head -1)
if [[ -n "$DMG_PATH" ]]; then
    DMG_SIZE=$(du -sh "$DMG_PATH" | cut -f1)
    log_success ".dmg installer: $DMG_PATH ($DMG_SIZE)"
else
    log_warn "No .dmg found in $BUNDLE_DIR/dmg/ (may not be generated on all configurations)"
fi

# Verify the app bundle structure
log_step "Verifying app bundle..."

if [[ -d "$APP_PATH/Contents" ]]; then
    # Check Info.plist
    if [[ -f "$APP_PATH/Contents/Info.plist" ]]; then
        BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP_PATH/Contents/Info.plist" 2>/dev/null || echo "unknown")
        BUNDLE_VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP_PATH/Contents/Info.plist" 2>/dev/null || echo "unknown")
        log_success "Bundle ID: $BUNDLE_ID"
        log_success "Version: $BUNDLE_VERSION"
    fi

    # Check icon
    if [[ -f "$APP_PATH/Contents/Resources/icon.icns" ]]; then
        log_success "App icon: Present"
    else
        log_warn "App icon not found in bundle Resources"
    fi

    # Check executable
    MACOS_DIR="$APP_PATH/Contents/MacOS"
    if [[ -d "$MACOS_DIR" ]]; then
        EXECUTABLE=$(ls "$MACOS_DIR" | head -1)
        if [[ -n "$EXECUTABLE" && -x "$MACOS_DIR/$EXECUTABLE" ]]; then
            ARCH_INFO=$(file "$MACOS_DIR/$EXECUTABLE")
            log_success "Executable: $EXECUTABLE"
            if echo "$ARCH_INFO" | grep -q "arm64"; then
                echo "    Architecture: arm64 (Apple Silicon)"
            fi
            if echo "$ARCH_INFO" | grep -q "x86_64"; then
                echo "    Architecture: x86_64 (Intel)"
            fi
        fi
    fi

    # Check code signature
    if codesign -v "$APP_PATH" 2>/dev/null; then
        log_success "Code signature: Valid"
    else
        log_warn "Code signature: Not signed or invalid (expected without APPLE_SIGNING_IDENTITY)"
    fi
fi

echo ""
log_success "Build complete!"
echo ""
echo "To install:"
if [[ -n "${DMG_PATH:-}" ]]; then
    echo "  1. Open the DMG: open \"$DMG_PATH\""
    echo "  2. Drag Task Manager to the Applications folder"
fi
echo ""
echo "To test the app directly:"
echo "  open \"$APP_PATH\""
