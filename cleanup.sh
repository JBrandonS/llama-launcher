#!/usr/bin/env bash
# cleanup.sh — Remove stale artifacts, build caches, and AI IDE leftovers
# Usage: ./cleanup.sh [--dry-run]
#
# This script is safe to run at any time. It removes:
#   - AI IDE state directories (.history/, .omc/, .sisyphus/)
#   - Python caches (__pycache__/, .pytest_cache/, .ruff_cache/)
#   - Build artifacts (dist/, build/, *.egg-info/)
#   - Node.js caches (node_modules/ — with confirmation)
#   - Log files (*.log, logs/)
#   - Compiled Python files (*.pyc, *.pyo)
#   - TypeScript build info (*.tsbuildinfo)
#
# Run with --dry-run to preview what would be deleted.

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "=== DRY RUN — nothing will be deleted ==="
    echo ""
fi

REMOVED=0
SKIPPED=0

remove_path() {
    local target="$1"
    if [[ -e "$target" ]]; then
        if $DRY_RUN; then
            echo "  [dry-run] would remove: $target"
        else
            rm -rf "$target"
            echo "  removed: $target"
        fi
        REMOVED=$((REMOVED + 1))
    else
        SKIPPED=$((SKIPPED + 1))
    fi
}

echo "=== llama-launcher cleanup ==="
echo ""

# AI IDE artifacts
echo "--- AI IDE state ---"
remove_path ".history/"
remove_path ".omc/"
remove_path ".sisyphus/"

# Python caches
echo "--- Python caches ---"
find . -type d -name "__pycache__" -exec remove_path {} \;
find . -type d -name ".pytest_cache" -exec remove_path {} \;
find . -type d -name ".ruff_cache" -exec remove_path {} \;

# Compiled Python files
echo "--- Compiled Python ---"
find . -type f \( -name "*.pyc" -o -name "*.pyo" \) -print -delete 2>/dev/null | while read -r f; do
    if $DRY_RUN; then
        echo "  [dry-run] would remove: $f"
    else
        echo "  removed: $f"
    fi
    REMOVED=$((REMOVED + 1))
done

# Build artifacts
echo "--- Build artifacts ---"
remove_path "dist/"
remove_path "build/"
find . -type d -name "*.egg-info" -exec remove_path {} \;

# Node.js caches (only in ui/, not root node_modules if it's a project dir)
echo "--- Node.js caches ---"
remove_path "ui/node_modules/"
remove_path "ui/dist/"

# Log files
echo "--- Log files ---"
remove_path "logs/"
find . -maxdepth 2 -type f -name "*.log" -print -delete 2>/dev/null | while read -r f; do
    if $DRY_RUN; then
        echo "  [dry-run] would remove: $f"
    else
        echo "  removed: $f"
    fi
    REMOVED=$((REMOVED + 1))
done

# TypeScript build info
echo "--- TypeScript build info ---"
find . -type f -name "*.tsbuildinfo" -print -delete 2>/dev/null | while read -r f; do
    if $DRY_RUN; then
        echo "  [dry-run] would remove: $f"
    else
        echo "  removed: $f"
    fi
    REMOVED=$((REMOVED + 1))
done

# Virtual environments (commented out by default — too destructive)
# echo "--- Virtual environments ---"
# remove_path ".venv/"
# remove_path "venv/"

echo ""
echo "=== Done ==="
echo "Removed: $REMOVED items"
echo "Skipped: $SKIPPED items (did not exist)"

if $DRY_RUN; then
    echo ""
    echo "This was a dry run. Run without --dry-run to actually delete."
fi
