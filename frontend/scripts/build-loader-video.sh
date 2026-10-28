#!/bin/sh
# Rebuild the original MN Bootcamp 2026 console clip.
set -eu
cd "$(dirname "$0")/.."
python3 scripts/build-loader-console.py
