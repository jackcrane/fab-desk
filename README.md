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

6. Seed the SAML provider config table (required before backend startup):

```bash
psql "$DATABASE_URL" -f backend/sql/2026-02-26_seed_saml_provider_configs.sql
```

7. Start backend + frontend:

```bash
npm run dev
```

## URLs

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:3000/health`
- Better Auth base path: `http://localhost:3000/api/auth`
- oRPC endpoint prefix: `http://localhost:3000/rpc`

## SAML SSO setup

SAML provider config is loaded from the database table `saml_provider_configs` at backend startup.

Run the one-time migration/seed script:

```bash
psql "$DATABASE_URL" -f backend/sql/2026-02-26_seed_saml_provider_configs.sql
```

For these examples, assume:

- `BETTER_AUTH_URL="https://jack-mac.jackcrane.rocks"`
- SP metadata URL pattern:
  - `https://jack-mac.jackcrane.rocks/api/auth/sso/saml2/sp/metadata?providerId=<providerId>`
- SP ACS URL pattern:
  - `https://jack-mac.jackcrane.rocks/api/auth/sso/saml2/sp/acs/<providerId>`

### Example 1: Add an Okta IdP for `acme.com`

```sql
INSERT INTO saml_provider_configs (
  provider_id,
  domains,
  issuer,
  entry_point,
  entry_point_binding,
  cert,
  callback_url,
  sp_entity_id,
  mapping,
  want_assertions_signed,
  authn_requests_signed,
  enabled
)
VALUES (
  'acme-okta',
  ARRAY['acme.com']::text[],
  'http://www.okta.com/exkabc1234567',
  'https://acme.okta.com/app/acme_fabdesk_1/abc123/sso/saml',
  'redirect',
  '-----BEGIN CERTIFICATE-----\nMIID...REPLACE_ME...\n-----END CERTIFICATE-----',
  'https://jack-mac.jackcrane.rocks/api/auth/sso/saml2/sp/acs/acme-okta',
  'https://jack-mac.jackcrane.rocks/api/auth/sso/saml2/sp/metadata?providerId=acme-okta',
  '{"email":"email","firstName":"firstName","lastName":"lastName","name":"displayName"}'::jsonb,
  TRUE,
  FALSE,
  TRUE
)
ON CONFLICT (provider_id) DO UPDATE
SET
  domains = EXCLUDED.domains,
  issuer = EXCLUDED.issuer,
  entry_point = EXCLUDED.entry_point,
  entry_point_binding = EXCLUDED.entry_point_binding,
  cert = EXCLUDED.cert,
  callback_url = EXCLUDED.callback_url,
  sp_entity_id = EXCLUDED.sp_entity_id,
  mapping = EXCLUDED.mapping,
  want_assertions_signed = EXCLUDED.want_assertions_signed,
  authn_requests_signed = EXCLUDED.authn_requests_signed,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();
```

### Example 2: Add a Microsoft Entra ID IdP for `contoso.com`

```sql
INSERT INTO saml_provider_configs (
  provider_id,
  domains,
  issuer,
  entry_point,
  entry_point_binding,
  cert,
  callback_url,
  sp_entity_id,
  mapping,
  want_assertions_signed,
  authn_requests_signed,
  enabled
)
VALUES (
  'contoso-entra',
  ARRAY['contoso.com']::text[],
  'https://sts.windows.net/11111111-2222-3333-4444-555555555555/',
  'https://login.microsoftonline.com/11111111-2222-3333-4444-555555555555/saml2',
  'post',
  '-----BEGIN CERTIFICATE-----\nMIIC...REPLACE_ME...\n-----END CERTIFICATE-----',
  'https://jack-mac.jackcrane.rocks/api/auth/sso/saml2/sp/acs/contoso-entra',
  'https://jack-mac.jackcrane.rocks/api/auth/sso/saml2/sp/metadata?providerId=contoso-entra',
  '{"email":"email","firstName":"givenName","lastName":"surname","name":"displayName"}'::jsonb,
  TRUE,
  FALSE,
  TRUE
)
ON CONFLICT (provider_id) DO UPDATE
SET
  domains = EXCLUDED.domains,
  issuer = EXCLUDED.issuer,
  entry_point = EXCLUDED.entry_point,
  entry_point_binding = EXCLUDED.entry_point_binding,
  cert = EXCLUDED.cert,
  callback_url = EXCLUDED.callback_url,
  sp_entity_id = EXCLUDED.sp_entity_id,
  mapping = EXCLUDED.mapping,
  want_assertions_signed = EXCLUDED.want_assertions_signed,
  authn_requests_signed = EXCLUDED.authn_requests_signed,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();
```

### Example 3: Verify configured IdPs

```sql
SELECT
  provider_id,
  domains,
  issuer,
  entry_point_binding,
  enabled,
  updated_at
FROM saml_provider_configs
ORDER BY provider_id;
```

### Verification checklist after adding an IdP

1. Restart backend.
2. Visit metadata endpoint:
   - `https://jack-mac.jackcrane.rocks/api/auth/sso/saml2/sp/metadata?providerId=<providerId>`
3. Sign in using an email from one of the configured domains.
4. Confirm callback returns to `/shop` without `?error=...`.
