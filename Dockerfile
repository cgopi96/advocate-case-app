# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

# Admin tools kept apart from the app bundle: the Prisma CLI for running
# migrations at startup, plus what deploy/create-admin.mjs needs.
FROM base AS tools
WORKDIR /tools
COPY package.json /tmp/package.json
COPY prisma ./prisma
RUN npm init -y >/dev/null \
  && v() { node -p "const p=require('/tmp/package.json'); p.dependencies['$1'] || p.devDependencies['$1']"; } \
  && npm install --no-audit --no-fund "prisma@$(v prisma)" "@prisma/client@$(v @prisma/client)" "bcryptjs@$(v bcryptjs)" \
  && npx prisma generate --schema prisma/schema.prisma

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r app && useradd -r -g app -d /app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=tools --chown=app:app /tools/node_modules ./tools/node_modules
COPY --chown=app:app deploy/start.sh ./
COPY --chown=app:app deploy/create-admin.mjs ./tools/
USER app
EXPOSE 3000
CMD ["./start.sh"]
