-- CreateTable
CREATE TABLE "saml_provider_configs" (
    "provider_id" TEXT NOT NULL,
    "domains" TEXT[],
    "issuer" TEXT NOT NULL,
    "entry_point" TEXT NOT NULL,
    "entry_point_binding" TEXT NOT NULL DEFAULT 'redirect',
    "cert" TEXT NOT NULL,
    "callback_url" TEXT,
    "sp_entity_id" TEXT,
    "sp_private_key" TEXT,
    "sp_private_key_pass" TEXT,
    "sp_metadata_xml" TEXT,
    "mapping" JSONB,
    "want_assertions_signed" BOOLEAN NOT NULL DEFAULT true,
    "authn_requests_signed" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saml_provider_configs_pkey" PRIMARY KEY ("provider_id")
);
