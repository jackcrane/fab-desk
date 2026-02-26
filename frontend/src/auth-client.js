import { createAuthClient } from 'better-auth/react';

const configuredAuthBaseUrl = import.meta.env.VITE_AUTH_URL?.trim();
const defaultAuthBaseUrl =
  typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin;
const authBaseUrl = new URL(
  configuredAuthBaseUrl || defaultAuthBaseUrl,
  defaultAuthBaseUrl,
)
  .toString()
  .replace(/\/$/, '');

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
});

export async function checkDomainForSso(email) {
  const response = await fetch(`${authBaseUrl}/api/auth/check-domain`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error =
      payload && typeof payload === 'object' && typeof payload.error === 'string'
        ? payload.error
        : 'Unable to check domain';
    throw new Error(error);
  }

  return {
    domain: typeof payload?.domain === 'string' ? payload.domain : '',
    requiresSso: Boolean(payload?.requiresSso),
    providerId: typeof payload?.providerId === 'string' ? payload.providerId : null,
    providerType: typeof payload?.providerType === 'string' ? payload.providerType : null,
  };
}

export async function signInWithSso({ email, providerId, providerType }) {
  const callbackURL = `${window.location.origin}/shop`;
  const errorCallbackURL = `${window.location.origin}/sign-in`;

  const response = await fetch(`${authBaseUrl}/api/auth/sign-in/sso`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      providerId,
      providerType: providerType ?? 'saml',
      callbackURL,
      errorCallbackURL,
    }),
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error =
      payload && typeof payload === 'object' && typeof payload.message === 'string'
        ? payload.message
        : payload && typeof payload === 'object' && typeof payload.error === 'string'
          ? payload.error
          : 'Unable to start SSO sign in';
    throw new Error(error);
  }

  const url = typeof payload?.url === 'string' ? payload.url : '';

  if (!url) {
    throw new Error('Unable to start SSO sign in');
  }

  window.location.assign(url);
}
