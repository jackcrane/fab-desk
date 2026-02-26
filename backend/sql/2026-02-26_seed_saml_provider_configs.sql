-- Manual migration: move SAML provider config from env vars to DB table.
-- Run with: psql "$DATABASE_URL" -f backend/sql/2026-02-26_seed_saml_provider_configs.sql

BEGIN;

CREATE TABLE IF NOT EXISTS saml_provider_configs (
  provider_id text PRIMARY KEY,
  domains text[] NOT NULL,
  issuer text NOT NULL,
  entry_point text NOT NULL,
  entry_point_binding text NOT NULL DEFAULT 'redirect',
  cert text NOT NULL,
  callback_url text,
  sp_entity_id text,
  sp_private_key text,
  sp_private_key_pass text,
  sp_metadata_xml text,
  mapping jsonb,
  want_assertions_signed boolean NOT NULL DEFAULT TRUE,
  authn_requests_signed boolean NOT NULL DEFAULT FALSE,
  enabled boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT saml_provider_configs_entry_point_binding_check
    CHECK (entry_point_binding IN ('redirect', 'post'))
);

CREATE INDEX IF NOT EXISTS saml_provider_configs_domains_gin_idx
  ON saml_provider_configs USING GIN (domains);

-- Normalize timestamp defaults for pre-existing tables created outside this script.
ALTER TABLE saml_provider_configs
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE saml_provider_configs
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE saml_provider_configs
SET updated_at = NOW()
WHERE updated_at IS NULL;

INSERT INTO saml_provider_configs (
  provider_id,
  domains,
  issuer,
  entry_point,
  entry_point_binding,
  cert,
  callback_url,
  sp_entity_id,
  sp_private_key,
  sp_private_key_pass,
  sp_metadata_xml,
  mapping,
  want_assertions_signed,
  authn_requests_signed,
  enabled,
  created_at,
  updated_at
)
VALUES
(
    'jackcrane-main-saml',
    ARRAY['cranedigitalplatforms.com']::text[],
    'http://www.okta.com/exk10hq4egrXX81QH698',
    'https://integrator-2240118.okta.com/app/integrator-2240118_fabdesk_1/exk10hq4egrXX81QH698/sso/saml',
    'redirect',
    '-----BEGIN CERTIFICATE-----
MIIDtDCCApygAwIBAgIGAZyZEeQDMA0GCSqGSIb3DQEBCwUAMIGaMQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzENMAsGA1UECgwET2t0YTEUMBIGA1UECwwLU1NPUHJvdmlkZXIxGzAZBgNVBAMMEmludGVncmF0b3ItMjI0MDExODEcMBoGCSqGSIb3DQEJARYNaW5mb0Bva3RhLmNvbTAeFw0yNjAyMjYwODI5MTJaFw0zNjAyMjYwODMwMTJaMIGaMQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzENMAsGA1UECgwET2t0YTEUMBIGA1UECwwLU1NPUHJvdmlkZXIxGzAZBgNVBAMMEmludGVncmF0b3ItMjI0MDExODEcMBoGCSqGSIb3DQEJARYNaW5mb0Bva3RhLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKGhH9N5oyWO98KUU4cKXT01lQv0+Pg5A+5fDjLaVfwxCAH1hzf+BIEYbsTa0ktYeEoGoUtD1ocyjh5Z/R822L2b3l40/z13has/+j4lI20Q9GFmSY9oe31A0c8GgfNs72LWj4eyXY9koELQUrOJrIAgRyZaPyz+pyUfCNRM9Vd1CtMhZTb9krPRpYU5xRAkf2MaO739ebeqn0chxrQeq2lwtqpFQIjWPd8S0g5kY8pmzASBdiyTPRZVnhbn3UyyQl8rl/gyhkI3OeaZzTMoiZA9Z3mQDj03kB+AOFU45v7nOd3URGSWPnPmJXnVaOMfBHy42chco/eYDsKUTulhexMCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAW04JTzYTZ1lBNPKqbru3fLJlSeaB50q0T7fnGLncTY5yURWaS1MM7u/5XZ4rKuKtfFNsPQ+tPBo/M3Lf0fZepA0Q8VMkqrd9c130V4qDNHcjfl5zytaC88IA65/Z58cLI948WTtFuByWhewKnut2OuKuouhrp99BNteFoG9H5eg8sZnwUFTKNlgFsoAEu9LLEUpjg8Ryd4PrbezcuXt/n4N8MAEcaymzIpSV4f3JkNUmV26MZ2bzaDg7Y/N3w/f49w7umyR00uCAgaM+7lgeohsMoxeHl+QufuUa+/osyVQSrVxX1hneS/PyjFqBaKHscnRPpaQyfosf4HljwQKivg==
-----END CERTIFICATE-----',
    'https://jack-mac.jackcrane.rocks/api/auth/sso/saml2/sp/acs/jackcrane-main-saml',
    'https://jack-mac.jackcrane.rocks/api/auth/sso/saml2/sp/metadata?providerId=jackcrane-main-saml',
    NULL,
    NULL,
    NULL,
    '{"email":"email","firstName":"firstName","lastName":"lastName","name":"displayName"}'::jsonb,
    TRUE,
    FALSE,
    TRUE,
    NOW(),
    NOW()
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
  sp_private_key = EXCLUDED.sp_private_key,
  sp_private_key_pass = EXCLUDED.sp_private_key_pass,
  sp_metadata_xml = EXCLUDED.sp_metadata_xml,
  mapping = EXCLUDED.mapping,
  want_assertions_signed = EXCLUDED.want_assertions_signed,
  authn_requests_signed = EXCLUDED.authn_requests_signed,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

COMMIT;
