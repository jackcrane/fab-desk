import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { sso } from '@better-auth/sso';
import { prisma } from './db';
import { authPublicUrl, getDefaultSsoProviders } from './saml-config.js';

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
    }),
  ],
  trustedOrigins: [...new Set([...frontendOrigins, authOrigin])],
});
