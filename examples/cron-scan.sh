#!/bin/bash
# Example: Cron job for periodic storage scans
#
# Add to crontab:
#   0 */6 * * * /path/to/storage-guardian-cron.sh /path/to/project >> /var/log/storage-guardian.log 2>&1

set -euo pipefail

SCAN_PATH="${1:?Usage: $0 <path-to-scan>}"
HISTORY_DIR="${SCAN_PATH}/.storage-guardian-history"
BUDGET_BYTES=$((1024 * 1024 * 1024))  # 1GB

# Run scan with markdown output, persisted to history
npx storage-guardian scan "$SCAN_PATH" \
  --format markdown \
  --history "$HISTORY_DIR" \
  --budget "$BUDGET_BYTES" \
  --exclude "node_modules,.git,dist,coverage,.next"

# Optionally: check trend and alert
npx storage-guardian trend --history "$HISTORY_DIR"
