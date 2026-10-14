# Deployment on Zoho Catalyst

The app runs on **Catalyst AppSail** as a Docker image. Its data lives in a
**managed PostgreSQL database in Mumbai**. Catalyst's own Data Store can't
replace PostgreSQL: it has no documented transactions and returns at most 300
rows per query. Uploaded documents are stored inside PostgreSQL, so the app
keeps nothing on AppSail's disk.

| Environment | Catalyst | Database | Updated when |
| --- | --- | --- | --- |
| Staging | Development environment | Staging database | Every merge to `main` once CI passes |
| Production | Production environment | Production database | You run **Deploy to Catalyst** → `production`, then press **Deploy to Production** in Catalyst |

## 1. Accounts

1. **Catalyst**: sign up on the India data centre at <https://catalyst.zoho.in>
   and create a project, for example `advocate`. Note the project name and the
   org ID from the console.
2. **PostgreSQL in Mumbai** (`ap-south-1`): for example Supabase or AWS RDS.
   Create two databases, `advocate_staging` and `advocate_prod`, with daily
   backups turned on. Copy each connection string, ending in `?sslmode=require`.

## 2. Catalyst CLI token (once, on your computer)

```bash
npm install -g zcatalyst-cli
catalyst login          # pick the IN data centre
catalyst token:generate # copy the token
```

## 3. GitHub settings

Repository → Settings → Environments. Create `staging` and `production`, and
add yourself as a required reviewer on `production`.

| Environment | Secret | Value |
| --- | --- | --- |
| staging | `DATABASE_URL` | Staging connection string |
| staging | `CATALYST_TOKEN` | Token from step 2 |
| staging | `CATALYST_ORG` | Catalyst org ID |
| staging | `CATALYST_PROJECT` | Catalyst project name |
| production | `DATABASE_URL` | Production connection string |

The repository secrets `APP_URL` (the production address) and `CRON_SECRET`
drive the daily reminders workflow, as before.

## 4. First deploy

1. Actions → **Deploy to Catalyst** → Run workflow → `staging`. This migrates
   the staging database and creates the `advocate` AppSail service.
2. In the Catalyst console, open AppSail → `advocate` → Configuration:
   - Memory **1024 MB**.
   - Environment variables for **Development**: `DATABASE_URL`,
     `RUN_MIGRATIONS=0`, a new random `SESSION_SECRET` and `CRON_SECRET`
     (`openssl rand -base64 48`), and the SMTP, WhatsApp and firm details from
     `.env.example`. Leave staging's SMTP empty or point it at a test inbox.
   - The same for **Production**, with production's own database and secrets.
3. Create the first admin from your computer, inside a clone of the repository:

   ```bash
   npm ci
   DATABASE_URL='<staging or production connection string>' \
     node deploy/create-admin.mjs "Office Admin" admin@firm.in 'AStrongPassword123'
   ```

4. Actions → **Deploy to Catalyst** → `production`, then press **Deploy to
   Production** in the Catalyst console.
5. Map the customer's domain (for example `cases.firm.in`) to the production
   AppSail service under Domain Mapping, and add the DNS record Catalyst shows.

## 5. Releasing a change

1. A pull request is merged into `main`.
2. CI passes, and staging updates automatically. Check it at the staging URL.
3. Actions → **Deploy to Catalyst** → `production`. This migrates the
   production database.
4. In Catalyst, press **Deploy to Production**.

Migrations only ever add to the database, so the old version keeps working
during the minutes between steps 3 and 4.

## 6. Backups

The database provider's daily backups cover everything, documents included.
For a copy you hold yourself, run this monthly from any computer:

```bash
pg_dump -Fc "$PRODUCTION_DATABASE_URL" -f advocate_$(date +%F).dump
```

## Limits to know

- Each request must finish within 30 seconds. Uploads are capped at 10 MB, so
  this is fine.
- AppSail stops idle instances after a few minutes. The first page load after
  a quiet spell takes a few seconds longer.
