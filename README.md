# Advocate Case Follow-up

A web app for a small law office to track clients, cases, hearing dates, follow-ups and case documents, so no hearing or client follow-up is missed.

Built with Next.js 15, PostgreSQL and Prisma. See the [requirements spec](https://claude.ai/code/artifact/d9deb039-0b3c-4303-82ce-e10dfa7c0823) for scope.

## Features

- **Dashboard:** today's hearings, the next 7 days, follow-ups due or overdue, active case count.
- **Clients and cases:** search, filter by status, assign an advocate.
- **Hearings:** record the outcome and next date; the next hearing is scheduled automatically.
- **Follow-ups:** calls, meetings and tasks with an owner and due date.
- **Documents:** PDF, JPG, PNG, DOC and DOCX up to 10 MB per case.
- **Calendar:** month view of all hearings.
- **Reminders:** every morning each staff member gets one email and/or WhatsApp message with tomorrow's hearings on their cases and their follow-ups that are due or overdue.
- **Billing:** invoices numbered per financial year (INV/2026-27/0001) with optional 18% GST split into CGST and SGST, printable as PDF; payments by cash, UPI, bank transfer, cheque or card; outstanding balance by client.
- **Users, reminders and audit log** (admin only).

## Roles

| Role | Can do |
| --- | --- |
| Admin | Everything, including users, deletes, cancelling invoices, reminders and the audit log |
| Advocate | Work on cases assigned to them only; view (not create or change) their invoices |
| Clerk | Add and update clients, cases, hearings, follow-ups, documents, invoices and payments for all cases; cannot delete |

## Security

- Passwords hashed with bcrypt (cost 12); accounts lock for 15 minutes after 5 failed logins.
- Sessions are signed, HTTP-only cookies that expire after 30 minutes of inactivity.
- Every page and action checks the user's role on the server; advocates get a 404 for cases that aren't theirs.
- Documents are stored outside the web root, checked by file signature, and only served to users who can access the case.
- Every create, update, delete, login and download is written to the audit log with user, time and IP.
- Security headers (HSTS, frame denial, no-sniff). Server actions have built-in CSRF origin checks.

## Running locally

```bash
cp .env.example .env          # then set DATABASE_URL and a random SESSION_SECRET
npm install
npx prisma migrate deploy
npm run db:seed               # creates the admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
npx tsx prisma/seed.ts --demo # optional: sample advocate, clerk, clients and cases
npm run dev
```

Open http://localhost:3000 and sign in with the seed admin.

## Reminders setup

1. Set `CRON_SECRET`, and the SMTP and/or WhatsApp variables in `.env` (see `.env.example`).
2. Add each staff member's mobile number on the Users page for WhatsApp.
3. Add repository secrets `APP_URL` and `CRON_SECRET` on GitHub. The `Daily reminders` workflow then calls `POST /api/cron/reminders` at 7:00 IST. Any other scheduler that can send that request works too.
4. Admins can send today's reminders immediately from the Reminders page to test the setup.

WhatsApp business-initiated messages must use a template approved in Meta's WhatsApp Manager. Create one whose body has three placeholders, for example: `Good morning {{1}}. You have {{2}} hearing(s) tomorrow and {{3}} follow-up(s) due. Please check the Case Follow-up app.`

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Deployment

Production runs on Zoho Catalyst AppSail with a managed PostgreSQL in Mumbai: see [docs/CATALYST.md](docs/CATALYST.md). The self-managed VPS option is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Making changes after go-live

1. Describe the change in the project; it is made on a branch with a pull request.
2. CI runs type checks, tests and a build on every pull request.
3. Merging deploys to staging automatically; check it there, then run the **Deploy to Catalyst** workflow for production and press Deploy to Production in Catalyst.
4. Database changes ship as Prisma migrations (`prisma migrate deploy`), which keep existing data.
