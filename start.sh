#!/bin/sh
set -eu
cd "$(dirname "$0")"
export BIND_HOST="${BIND_HOST:-0.0.0.0}"
exec node server.cjs
