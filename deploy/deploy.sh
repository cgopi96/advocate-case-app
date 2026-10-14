#!/bin/sh
# Deploy one environment on the server. Called by the GitHub deploy workflow:
#   deploy/deploy.sh staging main
#   deploy/deploy.sh production main
set -eu
env="$1"
ref="${2:-main}"
case "$env" in
  production) project=advocate-prod ;;
  staging) project=advocate-staging ;;
  *) echo "Unknown environment: $env" >&2; exit 1 ;;
esac
root="/opt/advocate/$env"
cd "$root"
git fetch --quiet origin "$ref"
git checkout --quiet --force FETCH_HEAD
cd deploy
docker compose --env-file "$root/.env.compose" -p "$project" up -d --build --remove-orphans
docker image prune -f >/dev/null
echo "Deployed $(git rev-parse --short HEAD) to $env"
