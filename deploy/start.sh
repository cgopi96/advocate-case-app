#!/bin/sh
# Apply any pending database migrations, then start the app.
set -e
node tools/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
exec node server.js
