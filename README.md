# fab-desk scaffold

Monorepo scaffold with:

- Backend: `oRPC` + `Prisma 7` + `Better Auth` (TypeScript required for Prisma 7 client generation)
- Frontend: `React` + `Vite` + `SWR` (JavaScript)
- Database: local PostgreSQL

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Create your local Postgres database (example):

```bash
createdb fab_desk
```

4. Set `BETTER_AUTH_SECRET` in `backend/.env` to a secure random value.

5. Run Prisma migrations and client generation:

```bash
npm run prisma:migrate
npm run prisma:generate
```

6. Start backend + frontend:

```bash
npm run dev
```

## URLs

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:3000/health`
- Better Auth base path: `http://localhost:3000/api/auth`
- oRPC endpoint prefix: `http://localhost:3000/rpc`
