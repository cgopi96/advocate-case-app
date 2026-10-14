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
- **Users and audit log** (admin only).

## Roles

| Role | Can do |
| --- | --- |
| Admin | Everything, including users, deletes and the audit log |
| Advocate | Work on cases assigned to them only |
| Clerk | Add and update clients, cases, hearings, follow-ups and documents for all cases; cannot delete |

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

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Making changes after go-live

1. Describe the change in the project; it is made on a branch with a pull request.
2. CI runs type checks, tests and a build on every pull request.
3. Check it on staging, then merge to deploy to production.
4. Database changes ship as Prisma migrations (`prisma migrate deploy`), which keep existing data.
