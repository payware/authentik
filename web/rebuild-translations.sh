#!/bin/bash
# Quick rebuild script for translation work
#
# Usage: ./rebuild-translations.sh
#
# This rebuilds only the locale files and bundles the frontend.
# Much faster than a full Docker image build.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Rebuilding locale files from XLIFF..."
npm run build-locales -- --force

echo ""
echo "Bundling frontend..."
npm run build

echo ""
echo "Done! Hard refresh your browser (Ctrl+Shift+R) to see changes."
