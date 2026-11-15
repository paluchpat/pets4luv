#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
if [[ -x "$project_root/.tools/runtime/node_modules/node/bin/node" ]]; then
  export PATH="$project_root/.tools/runtime/node_modules/node/bin:$PATH"
fi
exec npm run "${@:-dev}"
