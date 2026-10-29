#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
exec ./node_modules/.bin/electron --no-sandbox . "$@"
