#!/usr/bin/env sh
set -eu

: "${DB_NAME:?DB_NAME obrigatorio}"
: "${DB_USER:?DB_USER obrigatorio}"
: "${DB_HOST:?DB_HOST obrigatorio}"
: "${DB_PORT:?DB_PORT obrigatorio}"

export MARTIN_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD:-}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

exec martin --config /config/martin.yaml
