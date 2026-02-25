import { createAuthClient } from 'better-auth/react';

const authBaseUrl = import.meta.env.VITE_AUTH_URL ?? 'http://localhost:3000';

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
  };
}
