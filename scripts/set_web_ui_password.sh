#!/usr/bin/env bash
# Sets the BirdNET-Pi web UI password. The plaintext is never written to disk,
# never passed as an argument, and never echoed to the terminal.
set -euo pipefail

my_dir=$(realpath "$(dirname "$0")")
web_ui_dir="$(dirname "${my_dir}")/web-ui"
export BIRDNET_AUTH_CONF="${BIRDNET_AUTH_CONF:-/etc/birdnet/web-ui-auth.conf}"

if [ "${1:-}" = "--clear" ]; then
  (cd "${web_ui_dir}" && npx tsx src/lib/set-password-cli.ts --clear)
  exit 0
fi

# -s suppresses the echo; nothing here is added to shell history.
read -rsp "New web UI password: " password; echo
read -rsp "Confirm password: " confirm; echo

if [ "${password}" != "${confirm}" ]; then
  echo "Passwords do not match." >&2
  exit 1
fi

printf '%s' "${password}" | (cd "${web_ui_dir}" && npx tsx src/lib/set-password-cli.ts)
