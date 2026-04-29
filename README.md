# Filo Yonetimi

Production-grade fleet management platform built with Next.js, Prisma, PostgreSQL, and Auth.js.

## Tech Stack
- Next.js 16 (App Router)
- TypeScript
- Prisma ORM + PostgreSQL
- Auth.js (NextAuth v5)
- Tailwind CSS + shadcn/ui
- Recharts + SWR

## Features
- Fleet and vehicle inventory management
- Driver assignment (zimmet) and history
- Fuel, maintenance, penalty, HGS, and expense tracking
- Insurance (traffic + kasko) and document lifecycle tracking
- Multi-company scoping with role-based access control
- Dashboard analytics and deadline calendar
- Excel import/export endpoints for operational modules

## Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL 14+

## Setup
1. Install dependencies
```bash
npm install
```

2. Copy environment variables
```bash
cp .env.example .env
```

3. Edit `.env` and set valid credentials:
- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL`
- `ADMIN_BOOTSTRAP_PASSWORD` (optional; enables the database-independent `admin` login outside development)

4. Run database migrations
```bash
npx prisma migrate dev
npx prisma generate
```

For a Windows/server deployment, run the production migration flow before starting:
```bash
npm install
npm run db:deploy
npm run build
npm run start
```

`npm install` also runs `prisma generate`, so the generated Prisma client stays in sync with `prisma/schema.prisma`.

## Move Data Between Mac And Windows
Excel import is a merge tool: it updates matching rows and adds missing rows, but it does not delete rows that are absent from the file. For an exact Mac -> Windows copy, use a PostgreSQL database backup.

On the Mac, while the app is stopped:
```bash
npm run db:backup -- ./filo-db.dump
```

Copy `filo-db.dump` to the Windows project folder, stop the app there, set `.env` to the Windows database, then run:
```bash
npm install
npm run db:restore -- ./filo-db.dump --yes
npm run db:deploy
npm run build
npm run start
```

The restore command replaces objects in the target database. Use it only when the Mac database is the source of truth.

## Run
### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build:deploy
npm run start
```

## Quality Checks
```bash
npm run lint
```

## Directory Highlights
- `src/app` -> App Router pages and route handlers
- `src/lib` -> data, auth, and business services
- `src/components` -> reusable UI and layout components
- `prisma` -> schema and SQL migrations

## Notes
- Dashboard and Excel data are company-scoped by role policy.
- Driver role has restricted access to administrative pages.
- See `prisma/migrations` for schema evolution history.
