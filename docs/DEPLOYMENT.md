# Deployment on a VPS

This is the self-managed option. For Zoho Catalyst hosting see [CATALYST.md](CATALYST.md).

One Linux server runs both environments with Docker:

| Environment | Folder on server | Local port | Updated when |
| --- | --- | --- | --- |
| Staging | `/opt/advocate/staging` | 3001 | Every merge to `main` once CI passes |
| Production | `/opt/advocate/production` | 3000 | You run the **Deploy** workflow and pick `production` |

Caddy sits in front of both and gets HTTPS certificates automatically. Each environment has its own database and nightly backups. Uploaded documents are stored inside the database.

## 1. Server

- Ubuntu 24.04, **2 GB RAM or more** (the build needs it), 40 GB disk.
- Hosted in India, for example AWS Lightsail Mumbai (ap-south-1) or DigitalOcean Bangalore, so client data stays in India.
- Two DNS `A` records pointing at the server, for example `cases.firm.in` and `staging.cases.firm.in`.
- Firewall: allow ports 22, 80 and 443 only.

## 2. One-time setup (as a sudo user)

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# A read-only deploy key so the server can pull the private repository
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
#   GitHub → repository → Settings → Deploy keys → Add (read-only)
cat >> ~/.ssh/config <<'CFG'
Host github.com
  IdentityFile ~/.ssh/github_deploy
CFG

sudo mkdir -p /opt/advocate/backups && sudo chown -R $USER /opt/advocate
for env in production staging; do
  git clone git@github.com:cgopi96/advocate-case-app.git /opt/advocate/$env
done
```

## 3. Settings for each environment

For each of `production` and `staging`:

```bash
cd /opt/advocate/production            # then repeat for staging
cp .env.example .env.app               # fill in real values; DATABASE_URL is ignored here
cp deploy/.env.compose.example .env.compose
```

- In `.env.app`: a new random `SESSION_SECRET` and `CRON_SECRET` (`openssl rand -base64 48`), SMTP, WhatsApp and firm details. Staging must use **different secrets** from production. Point staging's SMTP at a test inbox, or leave it empty so staging never emails real staff.
- In `.env.compose`: a random `POSTGRES_PASSWORD`, the right `APP_ENV_FILE` path, `APP_PORT=3000` (production) or `3001` (staging), and `BACKUP_DIR=/opt/advocate/backups/<env>`.

Start both, then create the first admin:

```bash
/opt/advocate/production/deploy/deploy.sh production main
/opt/advocate/staging/deploy/deploy.sh staging main
docker compose -p advocate-prod exec app node tools/create-admin.mjs "Office Admin" admin@firm.in 'AStrongPassword123'
```

Start HTTPS:

```bash
cd /opt/advocate/production/deploy/caddy
PROD_DOMAIN=cases.firm.in STAGING_DOMAIN=staging.cases.firm.in docker compose up -d
```

## 4. Automatic deploys and reminders (GitHub)

Repository → Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | Server IP or hostname |
| `DEPLOY_USER` | The Linux user above |
| `DEPLOY_SSH_KEY` | A private key whose public half is in that user's `~/.ssh/authorized_keys` |
| `APP_URL` | `https://cases.firm.in` (for the daily reminders workflow) |
| `CRON_SECRET` | The production `CRON_SECRET` |

Also create a `production` environment under Settings → Environments and add yourself as a required reviewer, so a production deploy waits for your approval.

## 5. Releasing a change

1. A pull request is merged into `main`.
2. CI passes and staging updates automatically. Check it at the staging URL.
3. Actions → **Deploy** → Run workflow → `production`.
4. Database changes run automatically as migrations when the new version starts. They never delete existing data.

To roll back, run **Deploy** for `production` from an earlier commit, or on the server run `deploy/deploy.sh production <commit-sha>`.

## 6. Backups

The `backup` container writes a database dump (documents included) every night at 02:00 IST to `/opt/advocate/backups/<env>` and keeps 30 days. **Copy that folder off the server too** (for example a nightly `rclone` to Google Drive or S3), because a backup on the same server is lost with the server.

Restore into production:

```bash
cd /opt/advocate/production/deploy
docker compose -p advocate-prod stop app
docker compose -p advocate-prod exec -T db pg_restore -U advocate -d advocate --clean --if-exists < /opt/advocate/backups/production/db_YYYY-MM-DD_0200.dump
docker compose -p advocate-prod start app
```

Test a restore on staging every few months.

## 7. Day-to-day

```bash
docker compose -p advocate-prod ps                # status
docker compose -p advocate-prod logs -f app       # app logs
docker compose -p advocate-prod exec app node tools/create-admin.mjs "Name" email 'NewPassword123'   # reset an admin
```
