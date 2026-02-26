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

4. Set core auth env vars in `backend/.env`:
   - `BETTER_AUTH_SECRET` to a secure random value.
   - `BETTER_AUTH_URL` to the public backend URL used for auth callbacks.
     - Local: `http://localhost:3000`
     - Tunnel example: `https://jack-mac.jackcrane.rocks`

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

## SAML SSO setup

SAML defaults are configured in `backend/src/saml-config.js` and support multiple providers by domain.

Use one of these env patterns in `backend/.env`:

- Recommended multi-provider: `SAML_SSO_PROVIDERS_JSON` (array of provider objects)
- Single-provider fallback:
  - `SAML_PROVIDER_ID`
  - `SAML_EMAIL_DOMAINS`
  - `SAML_ISSUER`
  - `SAML_ENTRY_POINT`
  - `SAML_CERT`
  - Optional overrides:
    - `SAML_CALLBACK_URL`
    - `SAML_SP_ENTITY_ID`
    - `SAML_SP_PRIVATE_KEY`
    - `SAML_SP_PRIVATE_KEY_PASS`
