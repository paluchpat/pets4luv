#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ -e .env.catministrator || -L .env.catministrator ]]; then
  printf '%s\n' 'Bot settings already exist in .env.catministrator. Update that file locally to change the token.'
  exit 1
fi
if [[ ! -t 0 ]]; then
  printf '%s\n' 'Run this setup command directly in Terminal.' >&2
  exit 1
fi
read -r -s -p 'BotFather token (hidden): ' catmin_token
printf '\n'
if [[ ! "$catmin_token" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
  printf '%s\n' 'That does not look like a BotFather token.' >&2
  exit 1
fi
umask 077
set -o noclobber
printf 'TELEGRAM_BOT_TOKEN=%s\n' "$catmin_token" > .env.catministrator
printf '%s\n' 'Token saved locally. Start Catministrator with ./scripts/local.sh catministrator.'
