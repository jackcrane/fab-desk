import { prisma } from './db.ts'

const rawAuthPublicUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

export const authPublicUrl = rawAuthPublicUrl.replace(/\/+$/, '')

function parseCsv(value) {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function normalizeMultiline(value) {
  if (!value) {
    return ''
  }

  return value.replace(/\\n/g, '\n').trim()
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().toLowerCase()

  if (normalized === 'true') {
    return true
  }

  if (normalized === 'false') {
    return false
  }

  return fallback
}

function parseEntryPointBinding(value) {
  if (typeof value !== 'string') {
    return 'redirect'
  }

  const normalized = value.trim().toLowerCase()
  return normalized === 'post' ? 'post' : 'redirect'
}

const defaultSamlExtraFields = Object.freeze({
  firstName: 'firstName',
  lastName: 'lastName',
  givenName: 'givenName',
  surname: 'surname',
  displayName: 'displayName',
  fullName: 'name',
  commonName: 'cn',
  wsGivenName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  wsSurname: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  wsName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
})

function normalizeSamlMapping(rawMapping) {
  if (!rawMapping || typeof rawMapping !== 'object' || Array.isArray(rawMapping)) {
    return undefined
  }

  const mapping = {}
  const fieldNames = ['id', 'email', 'emailVerified', 'name', 'firstName', 'lastName']

  for (const fieldName of fieldNames) {
    const fieldValue = rawMapping[fieldName]
    if (typeof fieldValue === 'string' && fieldValue.trim()) {
      mapping[fieldName] = fieldValue.trim()
    }
  }

  if (
    rawMapping.extraFields &&
    typeof rawMapping.extraFields === 'object' &&
    !Array.isArray(rawMapping.extraFields)
  ) {
    const extraFields = {}
    for (const [key, value] of Object.entries(rawMapping.extraFields)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        continue
      }

      const normalizedKey = key.trim()
      const normalizedValue = value.trim()
      if (normalizedKey && normalizedValue) {
        extraFields[normalizedKey] = normalizedValue
      }
    }

    if (Object.keys(extraFields).length > 0) {
      mapping.extraFields = extraFields
    }
  }

  return Object.keys(mapping).length > 0 ? mapping : undefined
}

function buildSamlMapping(rawMapping) {
  const mapping = normalizeSamlMapping(rawMapping) ?? {}

  return {
    ...mapping,
    extraFields: {
      ...defaultSamlExtraFields,
      ...(mapping.extraFields ?? {}),
    },
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildSpMetadataXml({
  entityId,
  callbackUrl,
  authnRequestsSigned,
  wantAssertionsSigned,
}) {
  return [
    '<?xml version="1.0"?>',
    `<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${escapeXml(entityId)}">`,
    `<SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" AuthnRequestsSigned="${authnRequestsSigned ? 'true' : 'false'}" WantAssertionsSigned="${wantAssertionsSigned ? 'true' : 'false'}">`,
    '<AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" index="1"',
    `  Location="${escapeXml(callbackUrl)}"/>`,
    '</SPSSODescriptor>',
    '</EntityDescriptor>',
  ].join('')
}

function domainMatches(searchDomain, domainList) {
  const normalizedSearchDomain = searchDomain.toLowerCase()
  return domainList.some(
    (domain) =>
      normalizedSearchDomain === domain ||
      normalizedSearchDomain.endsWith(`.${domain}`),
  )
}

function createSamlProvider(config) {
  const providerId = String(config.providerId ?? '').trim()
  const domains = parseCsv(config.domains)
  const entryPointBinding = parseEntryPointBinding(config.entryPointBinding)
  const callbackUrl =
    config.callbackUrl ??
    `${authPublicUrl}/api/auth/sso/saml2/sp/acs/${encodeURIComponent(providerId)}`
  const certificate = normalizeMultiline(config.certificate)
  const spPrivateKey = normalizeMultiline(config.spPrivateKey)
  const spEntityId =
    config.spEntityId ??
    `${authPublicUrl}/api/auth/sso/saml2/sp/metadata?providerId=${encodeURIComponent(providerId)}`
  const spMetadataXml =
    config.spMetadataXml ??
    buildSpMetadataXml({
      entityId: spEntityId,
      callbackUrl,
      authnRequestsSigned: config.authnRequestsSigned,
      wantAssertionsSigned: config.wantAssertionsSigned,
    })
  const mapping = buildSamlMapping(config.mapping)

  const samlConfig = {
    issuer: String(config.issuer ?? '').trim(),
    entryPoint: String(config.entryPoint ?? '').trim(),
    entryPointBinding,
    cert: certificate,
    callbackUrl,
    spMetadata: {
      metadata: spMetadataXml,
      entityID: spEntityId,
      ...(spPrivateKey ? { privateKey: spPrivateKey } : {}),
      ...(config.spPrivateKeyPass ? { privateKeyPass: config.spPrivateKeyPass } : {}),
    },
    wantAssertionsSigned: config.wantAssertionsSigned,
    authnRequestsSigned: config.authnRequestsSigned,
    mapping,
  }

  const enabled =
    domains.length > 0 &&
    Boolean(samlConfig.issuer) &&
    Boolean(samlConfig.entryPoint) &&
    Boolean(samlConfig.cert)

  return {
    providerId,
    domains,
    domain: domains.join(','),
    providerType: 'saml',
    samlConfig,
    enabled,
  }
}

function normalizeProviderRow(rawRow) {
  if (!rawRow || typeof rawRow !== 'object') {
    return null
  }

  const providerId =
    typeof rawRow.provider_id === 'string' ? rawRow.provider_id.trim() : ''

  if (!providerId) {
    return null
  }

  const domains =
    Array.isArray(rawRow.domains)
      ? rawRow.domains.join(',')
      : typeof rawRow.domains === 'string'
        ? rawRow.domains
        : ''

  return {
    providerId,
    domains,
    issuer: typeof rawRow.issuer === 'string' ? rawRow.issuer : '',
    entryPoint: typeof rawRow.entry_point === 'string' ? rawRow.entry_point : '',
    entryPointBinding: parseEntryPointBinding(rawRow.entry_point_binding),
    certificate: typeof rawRow.cert === 'string' ? rawRow.cert : '',
    callbackUrl: typeof rawRow.callback_url === 'string' ? rawRow.callback_url : undefined,
    spEntityId: typeof rawRow.sp_entity_id === 'string' ? rawRow.sp_entity_id : undefined,
    spPrivateKey: typeof rawRow.sp_private_key === 'string' ? rawRow.sp_private_key : undefined,
    spPrivateKeyPass:
      typeof rawRow.sp_private_key_pass === 'string' ? rawRow.sp_private_key_pass : undefined,
    spMetadataXml: typeof rawRow.sp_metadata_xml === 'string' ? rawRow.sp_metadata_xml : undefined,
    wantAssertionsSigned: parseBoolean(rawRow.want_assertions_signed, true),
    authnRequestsSigned: parseBoolean(rawRow.authn_requests_signed, false),
    mapping: normalizeSamlMapping(rawRow.mapping),
    enabled: parseBoolean(rawRow.enabled, true),
  }
}

async function loadProviderInputsFromDatabase() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT
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
        enabled
      FROM saml_provider_configs
      ORDER BY provider_id ASC
    `

    if (!Array.isArray(rows)) {
      return []
    }

    return rows
      .map((row) => normalizeProviderRow(row))
      .filter(Boolean)
      .filter((provider) => provider.enabled !== false)
  } catch (error) {
    console.error('Unable to load SAML provider config from table saml_provider_configs.', error)
    throw new Error(
      'SAML provider configuration must be loaded from table "saml_provider_configs". Run backend/sql/2026-02-26_seed_saml_provider_configs.sql first.',
    )
  }
}

const providerInputs = await loadProviderInputsFromDatabase()

if (providerInputs.length === 0) {
  console.warn('No enabled SAML providers were found in table saml_provider_configs.')
}

export const samlProviders = providerInputs.map((provider) => createSamlProvider(provider))

export function getDefaultSsoProviders() {
  return samlProviders
    .filter((provider) => provider.enabled)
    .map((provider) => ({
      domain: provider.domain,
      providerId: provider.providerId,
      samlConfig: provider.samlConfig,
    }))
}

export function findSsoProviderByDomain(domain) {
  if (!domain) {
    return null
  }

  const normalizedDomain = domain.trim().toLowerCase()

  if (!normalizedDomain) {
    return null
  }

  const provider =
    samlProviders
      .filter((candidate) => candidate.enabled)
      .find((candidate) => domainMatches(normalizedDomain, candidate.domains)) ?? null

  if (!provider) {
    return null
  }

  return {
    providerId: provider.providerId,
    providerType: provider.providerType,
    domain: normalizedDomain,
  }
}

export function findSsoProviderByEmail(email) {
  if (!email || typeof email !== 'string') {
    return null
  }

  const emailDomain = email.split('@')[1]?.toLowerCase()

  if (!emailDomain) {
    return null
  }

  return findSsoProviderByDomain(emailDomain)
}

export function findDefaultSamlProviderForSignIn({ providerId, email, domain }) {
  const normalizedProviderId =
    typeof providerId === 'string' ? providerId.trim() : ''

  if (normalizedProviderId) {
    return (
      samlProviders
        .filter((provider) => provider.enabled)
        .find((provider) => provider.providerId === normalizedProviderId) ?? null
    )
  }

  const normalizedDomainCandidate =
    typeof domain === 'string'
      ? domain.trim().toLowerCase()
      : typeof email === 'string'
        ? email.split('@')[1]?.toLowerCase() ?? ''
        : ''

  if (!normalizedDomainCandidate) {
    return null
  }

  return (
    samlProviders
      .filter((provider) => provider.enabled)
      .find((provider) => domainMatches(normalizedDomainCandidate, provider.domains)) ?? null
  )
}
