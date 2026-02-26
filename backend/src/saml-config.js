const rawAuthPublicUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';

export const authPublicUrl = rawAuthPublicUrl.replace(/\/+$/, '');

function parseCsv(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function parseJsonArray(value) {
  if (!value || typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function normalizeMultiline(value) {
  if (!value) {
    return '';
  }

  return value.replace(/\\n/g, '\n').trim();
}

function parseBoolean(value, fallback = false) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return fallback;
}

function parseEntryPointBinding(value) {
  if (typeof value !== 'string') {
    return 'redirect';
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'post' ? 'post' : 'redirect';
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
});

function normalizeSamlMapping(rawMapping) {
  if (!rawMapping || typeof rawMapping !== 'object' || Array.isArray(rawMapping)) {
    return undefined;
  }

  const mapping = {};
  const fieldNames = ['id', 'email', 'emailVerified', 'name', 'firstName', 'lastName'];

  for (const fieldName of fieldNames) {
    const fieldValue = rawMapping[fieldName];
    if (typeof fieldValue === 'string' && fieldValue.trim()) {
      mapping[fieldName] = fieldValue.trim();
    }
  }

  if (
    rawMapping.extraFields &&
    typeof rawMapping.extraFields === 'object' &&
    !Array.isArray(rawMapping.extraFields)
  ) {
    const extraFields = {};
    for (const [key, value] of Object.entries(rawMapping.extraFields)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        continue;
      }

      const normalizedKey = key.trim();
      const normalizedValue = value.trim();
      if (normalizedKey && normalizedValue) {
        extraFields[normalizedKey] = normalizedValue;
      }
    }

    if (Object.keys(extraFields).length > 0) {
      mapping.extraFields = extraFields;
    }
  }

  return Object.keys(mapping).length > 0 ? mapping : undefined;
}

function buildSamlMapping(rawMapping) {
  const mapping = normalizeSamlMapping(rawMapping) ?? {};

  return {
    ...mapping,
    extraFields: {
      ...defaultSamlExtraFields,
      ...(mapping.extraFields ?? {}),
    },
  };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
  ].join('');
}

function domainMatches(searchDomain, domainList) {
  const normalizedSearchDomain = searchDomain.toLowerCase();
  return domainList.some(
    (domain) =>
      normalizedSearchDomain === domain ||
      normalizedSearchDomain.endsWith(`.${domain}`),
  );
}

function createSamlProvider(config) {
  const providerId = String(config.providerId ?? '').trim();
  const domains = parseCsv(config.domains);
  const entryPointBinding = parseEntryPointBinding(config.entryPointBinding);
  const callbackUrl =
    config.callbackUrl ??
    `${authPublicUrl}/api/auth/sso/saml2/sp/acs/${encodeURIComponent(providerId)}`;
  const certificate = normalizeMultiline(config.certificate);
  const spPrivateKey = normalizeMultiline(config.spPrivateKey);
  const spEntityId =
    config.spEntityId ??
    `${authPublicUrl}/api/auth/sso/saml2/sp/metadata?providerId=${encodeURIComponent(providerId)}`;
  const spMetadataXml =
    config.spMetadataXml ??
    buildSpMetadataXml({
      entityId: spEntityId,
      callbackUrl,
      authnRequestsSigned: config.authnRequestsSigned,
      wantAssertionsSigned: config.wantAssertionsSigned,
    });
  const mapping = buildSamlMapping(config.mapping);

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
  };

  const enabled =
    domains.length > 0 &&
    Boolean(samlConfig.issuer) &&
    Boolean(samlConfig.entryPoint) &&
    Boolean(samlConfig.cert);

  return {
    providerId,
    domains,
    domain: domains.join(','),
    providerType: 'saml',
    samlConfig,
    enabled,
  };
}

function normalizeProviderInput(rawProvider) {
  if (!rawProvider || typeof rawProvider !== 'object') {
    return null;
  }

  const providerId =
    typeof rawProvider.providerId === 'string' ? rawProvider.providerId : '';
  const domains =
    Array.isArray(rawProvider.domains)
      ? rawProvider.domains.join(',')
      : typeof rawProvider.domains === 'string'
        ? rawProvider.domains
        : '';
  const issuer =
    typeof rawProvider.issuer === 'string' ? rawProvider.issuer : '';
  const entryPoint =
    typeof rawProvider.entryPoint === 'string' ? rawProvider.entryPoint : '';
  const certificate =
    typeof rawProvider.cert === 'string' ? rawProvider.cert : '';
  const entryPointBinding =
    typeof rawProvider.entryPointBinding === 'string'
      ? rawProvider.entryPointBinding
      : undefined;

  if (!providerId) {
    return null;
  }

  return {
    providerId,
    domains,
    issuer,
    entryPoint,
    entryPointBinding,
    certificate,
    callbackUrl:
      typeof rawProvider.callbackUrl === 'string'
        ? rawProvider.callbackUrl
        : undefined,
    spEntityId:
      typeof rawProvider.spEntityId === 'string'
        ? rawProvider.spEntityId
        : undefined,
    spPrivateKey:
      typeof rawProvider.spPrivateKey === 'string'
        ? rawProvider.spPrivateKey
        : undefined,
    spPrivateKeyPass:
      typeof rawProvider.spPrivateKeyPass === 'string'
        ? rawProvider.spPrivateKeyPass
        : undefined,
    spMetadataXml:
      typeof rawProvider.spMetadataXml === 'string'
        ? rawProvider.spMetadataXml
        : undefined,
    wantAssertionsSigned:
      typeof rawProvider.wantAssertionsSigned === 'boolean'
        ? rawProvider.wantAssertionsSigned
        : true,
    authnRequestsSigned:
      typeof rawProvider.authnRequestsSigned === 'boolean'
        ? rawProvider.authnRequestsSigned
        : false,
    mapping: normalizeSamlMapping(rawProvider.mapping),
  };
}

const providersFromJson = parseJsonArray(process.env.SAML_SSO_PROVIDERS_JSON)
  .map(normalizeProviderInput)
  .filter(Boolean);

const singleProviderFallback = normalizeProviderInput({
  providerId: process.env.SAML_PROVIDER_ID,
  domains: process.env.SAML_EMAIL_DOMAINS,
  issuer: process.env.SAML_ISSUER,
  entryPoint: process.env.SAML_ENTRY_POINT,
  entryPointBinding: process.env.SAML_ENTRY_POINT_BINDING,
  cert: process.env.SAML_CERT,
  callbackUrl: process.env.SAML_CALLBACK_URL,
  spEntityId: process.env.SAML_SP_ENTITY_ID,
  spPrivateKey: process.env.SAML_SP_PRIVATE_KEY,
  spPrivateKeyPass: process.env.SAML_SP_PRIVATE_KEY_PASS,
  wantAssertionsSigned: parseBoolean(process.env.SAML_WANT_ASSERTIONS_SIGNED, true),
  authnRequestsSigned: parseBoolean(process.env.SAML_AUTHN_REQUESTS_SIGNED, false),
  mapping: parseJsonObject(process.env.SAML_ATTRIBUTE_MAPPING_JSON),
});

const providerInputs =
  providersFromJson.length > 0
    ? providersFromJson
    : singleProviderFallback
      ? [singleProviderFallback]
      : [];

export const samlProviders = providerInputs.map((provider) => createSamlProvider(provider));

export function getDefaultSsoProviders() {
  return samlProviders
    .filter((provider) => provider.enabled)
    .map((provider) => ({
      domain: provider.domain,
      providerId: provider.providerId,
      samlConfig: provider.samlConfig,
    }));
}

export function findSsoProviderByDomain(domain) {
  if (!domain) {
    return null;
  }

  const normalizedDomain = domain.trim().toLowerCase();

  if (!normalizedDomain) {
    return null;
  }

  const provider =
    samlProviders
      .filter((candidate) => candidate.enabled)
      .find((candidate) => domainMatches(normalizedDomain, candidate.domains)) ?? null;

  if (!provider) {
    return null;
  }

  return {
    providerId: provider.providerId,
    providerType: provider.providerType,
    domain: normalizedDomain,
  };
}

export function findSsoProviderByEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const emailDomain = email.split('@')[1]?.toLowerCase();

  if (!emailDomain) {
    return null;
  }

  return findSsoProviderByDomain(emailDomain);
}

export function findDefaultSamlProviderForSignIn({ providerId, email, domain }) {
  const normalizedProviderId =
    typeof providerId === 'string' ? providerId.trim() : '';

  if (normalizedProviderId) {
    return (
      samlProviders
        .filter((provider) => provider.enabled)
        .find((provider) => provider.providerId === normalizedProviderId) ?? null
    );
  }

  const normalizedDomainCandidate =
    typeof domain === 'string'
      ? domain.trim().toLowerCase()
      : typeof email === 'string'
        ? email.split('@')[1]?.toLowerCase() ?? ''
        : '';

  if (!normalizedDomainCandidate) {
    return null;
  }

  return (
    samlProviders
      .filter((provider) => provider.enabled)
      .find((provider) => domainMatches(normalizedDomainCandidate, provider.domains)) ?? null
  );
}
