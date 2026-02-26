import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { sso } from '@better-auth/sso';
import { prisma } from './db';
import { authPublicUrl, getDefaultSsoProviders } from './saml-config.js';

const samlFirstNameFields = [
  'firstName',
  'givenName',
  'wsGivenName',
  'given_name',
] as const;
const samlLastNameFields = [
  'lastName',
  'surname',
  'wsSurname',
  'familyName',
  'family_name',
] as const;
const samlFallbackNameFields = [
  'displayName',
  'fullName',
  'commonName',
  'wsName',
] as const;

function readNameValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalizedValue = readNameValue(item);
      if (normalizedValue) {
        return normalizedValue;
      }
    }
  }

  return null;
}

function readMappedNameField(
  userInfo: Record<string, unknown>,
  fieldNames: readonly string[],
): string | null {
  for (const fieldName of fieldNames) {
    const value = readNameValue(userInfo[fieldName]);
    if (value) {
      return value;
    }
  }

  return null;
}

function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}

function deriveNameFromSsoUserInfo(userInfo: Record<string, unknown>): string | null {
  const firstName = readMappedNameField(userInfo, samlFirstNameFields);
  const lastName = readMappedNameField(userInfo, samlLastNameFields);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  if (fullName) {
    return fullName;
  }

  const fallbackName = readMappedNameField(userInfo, samlFallbackNameFields);
  if (!fallbackName || looksLikeEmail(fallbackName)) {
    return null;
  }

  return fallbackName;
}

function parseFrontendOrigins(rawOrigins?: string): string[] {
  return (rawOrigins ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const frontendOrigins = parseFrontendOrigins(
  process.env.FRONTEND_ORIGINS ?? process.env.FRONTEND_ORIGIN,
);
const authOrigin = (() => {
  try {
    return new URL(authPublicUrl).origin;
  } catch {
    return authPublicUrl;
  }
})();
const defaultSsoProviders = getDefaultSsoProviders();

export const auth = betterAuth({
  baseURL: authPublicUrl,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    sso({
      defaultSSO: defaultSsoProviders,
      async provisionUser({ user, userInfo }) {
        const resolvedName = deriveNameFromSsoUserInfo(userInfo);
        if (!resolvedName || resolvedName === user.name) {
          return;
        }

        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { name: resolvedName },
          });
          user.name = resolvedName;
        } catch (error) {
          console.error('Unable to sync SSO user name', {
            userId: user.id,
            error,
          });
        }
      },
    }),
  ],
  trustedOrigins: [...new Set([...frontendOrigins, authOrigin])],
});
