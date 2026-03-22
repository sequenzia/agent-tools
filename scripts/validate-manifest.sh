#!/usr/bin/env bash
# validate-manifest.sh - Validate skills/manifest.json against actual skill directories
#
# Usage:
#   bash scripts/validate-manifest.sh
#
# Checks:
#   1. Every manifest entry has a matching directory with a SKILL.md file
#   2. Every skill directory has a manifest entry
#   3. SKILL.md frontmatter 'name:' field matches the manifest entry name
#
# Requires: jq

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$REPO_ROOT/skills/manifest.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass_count=0
fail_count=0
warn_count=0

pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    pass_count=$((pass_count + 1))
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    fail_count=$((fail_count + 1))
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    warn_count=$((warn_count + 1))
}

# Check dependencies
if ! command -v jq &>/dev/null; then
    echo "Error: jq is required but not installed. Install with: brew install jq" >&2
    exit 1
fi

if [[ ! -f "$MANIFEST" ]]; then
    echo "Error: Manifest not found at $MANIFEST" >&2
    exit 1
fi

echo "Validating manifest: $MANIFEST"
echo "---"

# Extract skill name from SKILL.md frontmatter
extract_name() {
    local skill_md="$1"
    local frontmatter
    frontmatter=$(sed -n '/^---$/,/^---$/p' "$skill_md")
    echo "$frontmatter" | grep -m1 '^name:' | sed 's/^name:[[:space:]]*//' || true
}

# Collect all manifest entries into a temp file for reverse check
manifest_list=$(mktemp)
trap "rm -f $manifest_list" EXIT

# Check each category in manifest
for category in $(jq -r '.categories | keys[]' "$MANIFEST"); do
    category_path=$(jq -r ".categories.\"$category\".path" "$MANIFEST")
    skill_dir="$REPO_ROOT/$category_path"

    echo ""
    echo "Category: $category ($category_path)"

    # Forward check: manifest entry -> directory
    for skill_name in $(jq -r ".categories.\"$category\".skills[].name" "$MANIFEST"); do
        dir="$skill_dir/$skill_name"
        skill_md="$dir/SKILL.md"
        echo "$category/$skill_name" >> "$manifest_list"

        if [[ ! -d "$dir" ]]; then
            fail "$category/$skill_name — manifest entry has no matching directory"
            continue
        fi

        if [[ ! -f "$skill_md" ]]; then
            fail "$category/$skill_name — directory exists but missing SKILL.md"
            continue
        fi

        # Check frontmatter name matches
        fm_name=$(extract_name "$skill_md")
        if [[ -z "$fm_name" ]]; then
            warn "$category/$skill_name — SKILL.md has no 'name:' in frontmatter"
        elif [[ "$fm_name" != "$skill_name" ]]; then
            warn "$category/$skill_name — SKILL.md name '$fm_name' != manifest name '$skill_name'"
        else
            pass "$category/$skill_name"
        fi
    done
done

# Reverse check: directory -> manifest entry
echo ""
echo "Reverse check: directories without manifest entries"

found_orphan=false
for category in $(jq -r '.categories | keys[]' "$MANIFEST"); do
    category_path=$(jq -r ".categories.\"$category\".path" "$MANIFEST")
    skill_dir="$REPO_ROOT/$category_path"

    [[ -d "$skill_dir" ]] || continue

    for dir in "$skill_dir"/*/; do
        [[ -d "$dir" ]] || continue
        dir_name=$(basename "$dir")
        if ! grep -q "^$category/$dir_name$" "$manifest_list"; then
            fail "$category/$dir_name — directory exists with no manifest entry"
            found_orphan=true
        fi
    done
done

if [[ "$found_orphan" == "false" ]]; then
    echo -e "${GREEN}No orphan directories found${NC}"
fi

# Summary
echo ""
echo "---"
echo -e "Results: ${GREEN}$pass_count passed${NC}, ${RED}$fail_count failed${NC}, ${YELLOW}$warn_count warnings${NC}"

if [[ $fail_count -gt 0 ]]; then
    exit 1
fi
exit 0
