#!/bin/sh
# Apply any pending database migrations, then start the app.
# Catalyst AppSail gives the port in X_ZOHO_CATALYST_LISTEN_PORT and kills an
# instance that isn't listening within 10 seconds, so there migrations run in
# the deploy workflow instead (RUN_MIGRATIONS=0).
set -e
export PORT="${X_ZOHO_CATALYST_LISTEN_PORT:-${PORT:-3000}}"
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  node tools/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
fi
exec node server.js
