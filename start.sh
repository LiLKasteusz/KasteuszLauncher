#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"
unset ELECTRON_RUN_AS_NODE
export PATH="/home/lilkasteusz/node-v22.23.3-linux-x64/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
exec ./node_modules/electron/dist/electron . --no-sandbox "$@"
