#!/bin/bash
set -e

echo "[post-merge] Installing dependencies..."
cd ati && npm install --prefer-offline 2>&1 | tail -5
echo "[post-merge] Done."
