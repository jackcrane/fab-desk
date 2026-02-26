import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { inflateRawSync } from 'node:zlib';
import { onError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/node';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth';
import { prisma } from './db';
import { router } from './router';
import {
  authPublicUrl,
  findDefaultSamlProviderForSignIn,
  findSsoProviderByEmail,
} from './saml-config.js';
import {
  createShopForUser,
  createShopInputSchema,
  listShopsForUser,
  ShopEditForbiddenError,
  ShopNotFoundForUserError,
  updateShopBasicSettingsForUser,
  updateShopBasicSettingsInputSchema,
} from './shops';

function parseFrontendOrigins(rawOrigins?: string): string[] {
  return (rawOrigins ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const frontendOrigins = parseFrontendOrigins(
  process.env.FRONTEND_ORIGINS ?? process.env.FRONTEND_ORIGIN,
);
const frontendOriginSet = new Set(frontendOrigins);

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error('oRPC error:', error);
    }),
  ],
});

const authHandler = toNodeHandler(auth);

const port = Number(process.env.PORT ?? 3000);
const frontendDevProxyUrl = (process.env.FRONTEND_DEV_PROXY_URL ?? 'http://localhost:5173').trim();
const frontendDevProxyEnabled =
  String(process.env.FRONTEND_DEV_PROXY_ENABLED ?? process.env.NODE_ENV !== 'production')
    .trim()
    .toLowerCase() !== 'false';
const authDebugEnabled =
  String(process.env.AUTH_DEBUG_LOGS ?? process.env.NODE_ENV !== 'production')
    .trim()
    .toLowerCase() !== 'false';

type SessionLookupMeta = {
  requestId: string;
  pathname: string;
  method: string;
  source: 'rpc' | 'shops';
};

function getHeaderStringValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (Array.isArray(value)) {
    const firstValue = value.find((entry) => entry.trim().length > 0);
    return firstValue ? firstValue.trim() : null;
  }

  return null;
}

function summarizeQueryForLogs(searchParams: URLSearchParams): Record<string, unknown> {
  const entries = Array.from(searchParams.entries());
  if (entries.length === 0) {
    return { keys: [] };
  }

  return {
    keys: entries.map(([key]) => key),
    values: Object.fromEntries(
      entries.map(([key, value]) => {
        if (/saml/i.test(key) || /signature/i.test(key) || /relaystate/i.test(key)) {
          return [key, `<redacted:${value.length}>`];
        }

        return [key, truncateForLog(value, 80)];
      }),
    ),
  };
}

function sanitizeEmailForLog(email: unknown): string | null {
  if (typeof email !== 'string') {
    return null;
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail.includes('@')) {
    return null;
  }

  const [localPart = '', domainPart = ''] = trimmedEmail.split('@');
  if (!localPart || !domainPart) {
    return null;
  }

  if (localPart.length <= 2) {
    return `**@${domainPart}`;
  }

  return `${localPart.slice(0, 2)}***@${domainPart}`;
}

function truncateForLog(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...<trimmed>`;
}

function hashValueForLog(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function parseCookieHeader(rawCookieHeader: string | undefined): Record<string, string> {
  if (!rawCookieHeader) {
    return {};
  }

  const cookies: Record<string, string> = {};
  for (const cookieEntry of rawCookieHeader.split(';')) {
    const separatorIndex = cookieEntry.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const cookieName = cookieEntry.slice(0, separatorIndex).trim();
    if (!cookieName) {
      continue;
    }

    cookies[cookieName] = cookieEntry.slice(separatorIndex + 1).trim();
  }

  return cookies;
}

function summarizeCookieHeader(rawCookieHeader: string | undefined): Record<string, unknown> {
  const parsedCookies = parseCookieHeader(rawCookieHeader);
  const cookieEntries = Object.entries(parsedCookies);
  const cookieNames = cookieEntries.map(([name]) => name).sort();
  const authCookies = cookieEntries
    .filter(([cookieName]) => /(auth|session|token|csrf|state|sso)/i.test(cookieName))
    .map(([cookieName, cookieValue]) => ({
      name: cookieName,
      fingerprint: hashValueForLog(cookieValue),
      size: cookieValue.length,
    }));

  return {
    count: cookieNames.length,
    names: cookieNames,
    authCookies,
  };
}

function summarizeSessionForLog(session: unknown): Record<string, unknown> {
  if (!session || typeof session !== 'object') {
    return { present: false };
  }

  const maybeSession = session as {
    session?: { id?: unknown; expiresAt?: unknown };
    user?: { id?: unknown; email?: unknown };
  };
  const userId = typeof maybeSession.user?.id === 'string' ? maybeSession.user.id : null;
  const userEmail = sanitizeEmailForLog(maybeSession.user?.email);
  const sessionId = typeof maybeSession.session?.id === 'string' ? maybeSession.session.id : null;
  const expiresAt =
    typeof maybeSession.session?.expiresAt === 'string' || maybeSession.session?.expiresAt instanceof Date
      ? maybeSession.session.expiresAt
      : null;
  const topLevelKeys = Object.keys(session as Record<string, unknown>);

  return {
    present: true,
    topLevelKeys,
    userId,
    userEmail,
    sessionId,
    expiresAt,
  };
}

function resolveOrigin(urlOrOrigin: string): string | null {
  try {
    return new URL(urlOrOrigin).origin;
  } catch {
    return null;
  }
}

function normalizeSsoRedirectUrlToAuthOrigin(
  rawUrl: unknown,
  authOrigin: string | null,
): { value: string | null; normalized: boolean; reason: string | null } {
  if (typeof rawUrl !== 'string') {
    return { value: null, normalized: false, reason: 'missing_or_non_string' };
  }

  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    return { value: null, normalized: false, reason: 'empty_string' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return { value: null, normalized: false, reason: 'invalid_url' };
  }

  if (!authOrigin || parsedUrl.origin === authOrigin) {
    return { value: parsedUrl.toString(), normalized: false, reason: null };
  }

  let normalizedUrl: URL;
  try {
    normalizedUrl = new URL(`${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`, authOrigin);
  } catch {
    return { value: parsedUrl.toString(), normalized: false, reason: 'failed_to_normalize' };
  }

  return { value: normalizedUrl.toString(), normalized: true, reason: null };
}

function getWebSetCookieNames(headers: Headers): string[] {
  const getSetCookieHeader = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies =
    typeof getSetCookieHeader === 'function'
      ? getSetCookieHeader.call(headers)
      : headers.get('set-cookie')
        ? [headers.get('set-cookie') as string]
        : [];

  return setCookies
    .map((cookie) => cookie.split(';')[0]?.split('=')[0]?.trim() ?? '')
    .filter(Boolean);
}

function getNodeSetCookieNames(res: ServerResponse): string[] {
  const setCookieHeader = res.getHeader('set-cookie');
  if (!setCookieHeader) {
    return [];
  }

  const cookieEntries = Array.isArray(setCookieHeader)
    ? setCookieHeader.map(String)
    : [String(setCookieHeader)];

  return cookieEntries
    .map((cookie) => cookie.split(';')[0]?.split('=')[0]?.trim() ?? '')
    .filter(Boolean);
}

function authDebugLog(requestId: string, event: string, payload: Record<string, unknown>): void {
  if (!authDebugEnabled) {
    return;
  }

  console.log('[auth-debug]', {
    requestId,
    event,
    ...payload,
  });
}

function withAuthCors(req: IncomingMessage, res: ServerResponse, origin: string): void {
  const requestedHeaders = req.headers['access-control-request-headers'];

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Headers',
    requestedHeaders ?? 'content-type, authorization',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
}

function isHopByHopHeader(headerName: string): boolean {
  const normalizedHeader = headerName.toLowerCase();
  return (
    normalizedHeader === 'connection' ||
    normalizedHeader === 'keep-alive' ||
    normalizedHeader === 'proxy-authenticate' ||
    normalizedHeader === 'proxy-authorization' ||
    normalizedHeader === 'te' ||
    normalizedHeader === 'trailer' ||
    normalizedHeader === 'transfer-encoding' ||
    normalizedHeader === 'upgrade' ||
    normalizedHeader === 'host'
  );
}

function shouldProxyToFrontend(pathname: string): boolean {
  if (pathname === '/health') {
    return false;
  }

  if (pathname.startsWith('/api/') || pathname === '/api') {
    return false;
  }

  if (pathname.startsWith('/rpc') || pathname === '/rpc') {
    return false;
  }

  return true;
}

async function readRawBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks);
}

async function maybeProxyToFrontendDev(
  req: IncomingMessage,
  res: ServerResponse,
  requestUrl: URL,
): Promise<boolean> {
  if (!frontendDevProxyEnabled || !frontendDevProxyUrl || !shouldProxyToFrontend(requestUrl.pathname)) {
    return false;
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, frontendDevProxyUrl);
  } catch {
    return false;
  }

  const headers = new Headers();
  for (const [headerName, headerValue] of Object.entries(req.headers)) {
    if (!headerValue || isHopByHopHeader(headerName)) {
      continue;
    }

    if (Array.isArray(headerValue)) {
      for (const value of headerValue) {
        headers.append(headerName, value);
      }
    } else {
      headers.set(headerName, headerValue);
    }
  }

  let body: Buffer | undefined;
  const method = (req.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    body = await readRawBody(req);
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, {
      method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
      redirect: 'manual',
    });
  } catch (error) {
    console.error('Frontend dev proxy error:', error);
    res.statusCode = 502;
    res.end('Frontend dev server unavailable');
    return true;
  }

  const getSetCookieHeader = (upstreamResponse.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies =
    typeof getSetCookieHeader === 'function' ? getSetCookieHeader.call(upstreamResponse.headers) : [];
  if (setCookies.length > 0) {
    res.setHeader('set-cookie', setCookies);
  }

  for (const [headerName, headerValue] of upstreamResponse.headers.entries()) {
    if (isHopByHopHeader(headerName) || headerName.toLowerCase() === 'set-cookie') {
      continue;
    }

    res.setHeader(headerName, headerValue);
  }

  res.statusCode = upstreamResponse.status;

  const responseBody = await upstreamResponse.arrayBuffer();
  res.end(Buffer.from(responseBody));
  return true;
}

async function getSession(req: IncomingMessage, meta: SessionLookupMeta) {
  const cookieSummary = summarizeCookieHeader(getHeaderStringValue(req.headers.cookie) ?? undefined);
  authDebugLog(meta.requestId, 'session.lookup.start', {
    source: meta.source,
    pathname: meta.pathname,
    method: meta.method,
    cookieSummary,
  });

  try {
    const session = await auth.api.getSession({
      headers: new Headers(req.headers as HeadersInit),
    });

    authDebugLog(meta.requestId, 'session.lookup.success', {
      source: meta.source,
      pathname: meta.pathname,
      method: meta.method,
      sessionSummary: summarizeSessionForLog(session),
    });
    return session;
  } catch (error) {
    authDebugLog(meta.requestId, 'session.lookup.error', {
      source: meta.source,
      pathname: meta.pathname,
      method: meta.method,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, {
    'content-type': 'application/json',
  });
  res.end(JSON.stringify(payload));
}

function getSessionUserId(session: unknown): string | null {
  if (!session || typeof session !== 'object') {
    return null;
  }

  const maybeUser = (session as { user?: { id?: unknown } }).user;
  return typeof maybeUser?.id === 'string' ? maybeUser.id : null;
}

function normalizeBase64Input(value: string): string {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = normalizedValue.length % 4;
  if (remainder === 0) {
    return normalizedValue;
  }

  return `${normalizedValue}${'='.repeat(4 - remainder)}`;
}

function toSamlPostRedirectPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const url = typeof (payload as { url?: unknown }).url === 'string'
    ? (payload as { url: string }).url
    : '';

  if (!url) {
    return null;
  }

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(url);
  } catch {
    return null;
  }

  const compressedSamlRequest = redirectUrl.searchParams.get('SAMLRequest');
  if (!compressedSamlRequest) {
    return null;
  }

  let inflatedSamlRequest: Buffer;
  try {
    inflatedSamlRequest = inflateRawSync(Buffer.from(normalizeBase64Input(compressedSamlRequest), 'base64'));
  } catch {
    return null;
  }

  const formData: Record<string, string> = {};
  for (const [key, value] of redirectUrl.searchParams.entries()) {
    if (key === 'SAMLRequest' || key === 'SigAlg' || key === 'Signature') {
      continue;
    }

    formData[key] = value;
  }

  formData.SAMLRequest = inflatedSamlRequest.toString('base64');

  return {
    url: `${redirectUrl.origin}${redirectUrl.pathname}`,
    redirect: true,
    method: 'POST',
    formData,
  };
}

function applyWebResponseHeaders(sourceHeaders: Headers, res: ServerResponse): void {
  const getSetCookieHeader = (sourceHeaders as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = typeof getSetCookieHeader === 'function' ? getSetCookieHeader.call(sourceHeaders) : [];
  if (setCookies.length > 0) {
    res.setHeader('set-cookie', setCookies);
  } else {
    const setCookie = sourceHeaders.get('set-cookie');
    if (setCookie) {
      res.setHeader('set-cookie', setCookie);
    }
  }

  for (const [headerName, headerValue] of sourceHeaders.entries()) {
    const normalizedHeader = headerName.toLowerCase();
    if (normalizedHeader === 'set-cookie' || normalizedHeader === 'content-length') {
      continue;
    }

    res.setHeader(headerName, headerValue);
  }
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = requestUrl.pathname;
  const requestIdHeader = getHeaderStringValue(req.headers['x-request-id']);
  const requestId = requestIdHeader ?? randomUUID().slice(0, 12);
  const method = (req.method ?? 'GET').toUpperCase();
  res.setHeader('x-request-id', requestId);

  const shouldLogRequest =
    pathname.startsWith('/api/auth') || pathname.startsWith('/rpc') || pathname.startsWith('/api/shops');
  const requestStart = Date.now();
  const requestCookieSummary = summarizeCookieHeader(getHeaderStringValue(req.headers.cookie) ?? undefined);

  if (shouldLogRequest) {
    authDebugLog(requestId, 'request.start', {
      method,
      pathname,
      query: summarizeQueryForLogs(requestUrl.searchParams),
      origin: getHeaderStringValue(req.headers.origin),
      referer: getHeaderStringValue(req.headers.referer),
      host: getHeaderStringValue(req.headers.host),
      cookieSummary: requestCookieSummary,
    });

    res.on('finish', () => {
      authDebugLog(requestId, 'request.finish', {
        method,
        pathname,
        statusCode: res.statusCode,
        durationMs: Date.now() - requestStart,
        location: String(res.getHeader('location') ?? ''),
        responseSetCookies: getNodeSetCookieNames(res),
      });
    });
  }

  const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : null;
  const requestHost = getHeaderStringValue(req.headers.host);
  const authOrigin = resolveOrigin(authPublicUrl);
  const isLocalhostRequestHost = Boolean(requestHost && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestHost));

  if (requestOrigin && frontendOriginSet.has(requestOrigin)) {
    withAuthCors(req, res, requestOrigin);
  }

  if (pathname === '/api/auth/check-domain') {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    let payload: unknown;

    try {
      payload = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON payload' });
      return;
    }

    const email =
      payload && typeof payload === 'object' && typeof (payload as { email?: unknown }).email === 'string'
        ? (payload as { email: string }).email.trim()
        : '';
    const domain = email.split('@')[1]?.toLowerCase() ?? '';

    if (!domain) {
      sendJson(res, 400, { error: 'Valid email is required' });
      return;
    }

    const ssoProvider = findSsoProviderByEmail(email);
    authDebugLog(requestId, 'auth.check-domain.result', {
      method,
      pathname,
      email: sanitizeEmailForLog(email),
      domain,
      requiresSso: Boolean(ssoProvider),
      providerId: ssoProvider?.providerId ?? null,
      providerType: ssoProvider?.providerType ?? null,
    });

    sendJson(res, 200, {
      domain,
      requiresSso: Boolean(ssoProvider),
      providerId: ssoProvider?.providerId ?? null,
      providerType: ssoProvider?.providerType ?? null,
    });
    return;
  }

  if (pathname === '/api/auth/sign-in/sso') {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      await authHandler(req, res);
      return;
    }

    let payload: unknown;
    try {
      payload = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON payload' });
      return;
    }

    const signInBody: Record<string, unknown> =
      payload && typeof payload === 'object' ? { ...(payload as Record<string, unknown>) } : {};
    if (
      authOrigin &&
      isLocalhostRequestHost &&
      typeof signInBody.callbackURL === 'string'
    ) {
      const normalizedCallbackUrl = normalizeSsoRedirectUrlToAuthOrigin(signInBody.callbackURL, authOrigin);
      if (normalizedCallbackUrl.value) {
        signInBody.callbackURL = normalizedCallbackUrl.value;
      }

      const normalizedErrorCallbackUrl = normalizeSsoRedirectUrlToAuthOrigin(
        signInBody.errorCallbackURL,
        authOrigin,
      );
      if (normalizedErrorCallbackUrl.value) {
        signInBody.errorCallbackURL = normalizedErrorCallbackUrl.value;
      }

      authDebugLog(requestId, 'auth.sign-in-sso.callback-normalization', {
        requestHost,
        authOrigin,
        originalCallbackURL:
          typeof (payload as { callbackURL?: unknown }).callbackURL === 'string'
            ? (payload as { callbackURL: string }).callbackURL
            : null,
        effectiveCallbackURL:
          typeof signInBody.callbackURL === 'string' ? signInBody.callbackURL : null,
        callbackWasNormalized: normalizedCallbackUrl.normalized,
        callbackNormalizationReason: normalizedCallbackUrl.reason,
        originalErrorCallbackURL:
          typeof (payload as { errorCallbackURL?: unknown }).errorCallbackURL === 'string'
            ? (payload as { errorCallbackURL: string }).errorCallbackURL
            : null,
        effectiveErrorCallbackURL:
          typeof signInBody.errorCallbackURL === 'string' ? signInBody.errorCallbackURL : null,
        errorCallbackWasNormalized: normalizedErrorCallbackUrl.normalized,
        errorCallbackNormalizationReason: normalizedErrorCallbackUrl.reason,
      });
    }
    const provider =
      payload && typeof payload === 'object'
        ? findDefaultSamlProviderForSignIn({
            providerId:
              typeof (payload as { providerId?: unknown }).providerId === 'string'
                ? (payload as { providerId: string }).providerId
                : null,
            email:
              typeof (payload as { email?: unknown }).email === 'string'
                ? (payload as { email: string }).email
                : null,
            domain:
              typeof (payload as { domain?: unknown }).domain === 'string'
                ? (payload as { domain: string }).domain
                : null,
          })
        : null;
    const shouldUsePostBinding = provider?.samlConfig?.entryPointBinding === 'post';
    authDebugLog(requestId, 'auth.sign-in-sso.request', {
      method,
      pathname,
      providerId:
        typeof (payload as { providerId?: unknown }).providerId === 'string'
          ? (payload as { providerId: string }).providerId
          : null,
      email: sanitizeEmailForLog((payload as { email?: unknown }).email),
      domain:
        typeof (payload as { domain?: unknown }).domain === 'string'
          ? (payload as { domain: string }).domain
          : null,
      callbackURL:
        typeof signInBody.callbackURL === 'string' ? signInBody.callbackURL : null,
      errorCallbackURL:
        typeof signInBody.errorCallbackURL === 'string' ? signInBody.errorCallbackURL : null,
      resolvedProviderId: provider?.providerId ?? null,
      entryPointBinding: provider?.samlConfig?.entryPointBinding ?? null,
      shouldUsePostBinding,
    });

    const authResponse = await auth.api.signInSSO({
      body: signInBody as any,
      headers: new Headers(req.headers as HeadersInit),
      asResponse: true,
    });
    const responseBody = await authResponse.text();
    authDebugLog(requestId, 'auth.sign-in-sso.response', {
      statusCode: authResponse.status,
      ok: authResponse.ok,
      contentType: authResponse.headers.get('content-type'),
      location: authResponse.headers.get('location'),
      responseSetCookies: getWebSetCookieNames(authResponse.headers),
      responseBodyLength: responseBody.length,
    });

    applyWebResponseHeaders(authResponse.headers, res);

    if (!authResponse.ok || !shouldUsePostBinding) {
      if (!authResponse.ok) {
        authDebugLog(requestId, 'auth.sign-in-sso.error', {
          statusCode: authResponse.status,
          responseBodyPreview: truncateForLog(responseBody, 350),
        });
      }
      res.statusCode = authResponse.status;
      res.end(responseBody);
      return;
    }

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(responseBody);
    } catch {
      authDebugLog(requestId, 'auth.sign-in-sso.parse-error', {
        reason: 'Unable to parse Better Auth response as JSON while converting redirect to POST binding',
        responseBodyPreview: truncateForLog(responseBody, 350),
      });
      res.statusCode = authResponse.status;
      res.end(responseBody);
      return;
    }

    const transformedResponse = toSamlPostRedirectPayload(parsedResponse);
    if (!transformedResponse) {
      authDebugLog(requestId, 'auth.sign-in-sso.transform-skip', {
        reason: 'Could not transform SAML redirect payload for POST binding',
      });
      res.statusCode = authResponse.status;
      res.end(responseBody);
      return;
    }
    let transformedTarget: URL | null = null;
    try {
      transformedTarget = new URL(transformedResponse.url);
    } catch {
      transformedTarget = null;
    }
    authDebugLog(requestId, 'auth.sign-in-sso.transform-success', {
      targetOrigin: transformedTarget?.origin ?? null,
      targetPathname: transformedTarget?.pathname ?? null,
      formDataKeys: Object.keys(transformedResponse.formData ?? {}),
    });

    sendJson(res, authResponse.status, transformedResponse);
    return;
  }

  if (pathname.startsWith('/api/auth')) {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    authDebugLog(requestId, 'auth.route.dispatch', {
      method,
      pathname,
      query: summarizeQueryForLogs(requestUrl.searchParams),
    });
    await authHandler(req, res);
    authDebugLog(requestId, 'auth.route.complete', {
      method,
      pathname,
      statusCode: res.statusCode,
      location: String(res.getHeader('location') ?? ''),
      responseSetCookies: getNodeSetCookieNames(res),
    });
    return;
  }

  if (pathname.startsWith('/api/shops') && req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (pathname === '/api/shops') {
    const session = await getSession(req, {
      requestId,
      pathname,
      method,
      source: 'shops',
    });
    const userId = getSessionUserId(session);

    if (!userId) {
      authDebugLog(requestId, 'shops.unauthorized', {
        method,
        pathname,
        sessionSummary: summarizeSessionForLog(session),
      });
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    try {
      if (req.method === 'GET') {
        const shops = await listShopsForUser(userId);
        sendJson(res, 200, { shops });
        return;
      }

      if (req.method === 'POST') {
        let payload: unknown;

        try {
          payload = await readJsonBody(req);
        } catch {
          sendJson(res, 400, { error: 'Invalid JSON payload' });
          return;
        }

        const parsedPayload = createShopInputSchema.safeParse(payload);

        if (!parsedPayload.success) {
          sendJson(res, 400, {
            error: 'Invalid shop payload',
            issues: parsedPayload.error.issues,
          });
          return;
        }

        const shop = await createShopForUser(userId, parsedPayload.data);
        sendJson(res, 201, { shop });
        return;
      }
    } catch (error) {
      console.error('Shop API error:', error);
      sendJson(res, 500, { error: 'Internal server error' });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const shopDetailMatch = pathname.match(/^\/api\/shops\/([^/]+)$/);

  if (shopDetailMatch) {
    const session = await getSession(req, {
      requestId,
      pathname,
      method,
      source: 'shops',
    });
    const userId = getSessionUserId(session);

    if (!userId) {
      authDebugLog(requestId, 'shops.detail.unauthorized', {
        method,
        pathname,
        sessionSummary: summarizeSessionForLog(session),
      });
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    let shopId: string;

    try {
      shopId = decodeURIComponent(shopDetailMatch[1]);
    } catch {
      sendJson(res, 400, { error: 'Invalid shop id' });
      return;
    }

    try {
      if (req.method === 'PATCH') {
        let payload: unknown;

        try {
          payload = await readJsonBody(req);
        } catch {
          sendJson(res, 400, { error: 'Invalid JSON payload' });
          return;
        }

        const parsedPayload = updateShopBasicSettingsInputSchema.safeParse(payload);

        if (!parsedPayload.success) {
          sendJson(res, 400, {
            error: 'Invalid shop payload',
            issues: parsedPayload.error.issues,
          });
          return;
        }

        const shop = await updateShopBasicSettingsForUser(userId, shopId, parsedPayload.data);
        sendJson(res, 200, { shop });
        return;
      }
    } catch (error) {
      if (error instanceof ShopNotFoundForUserError) {
        sendJson(res, 404, { error: error.message });
        return;
      }

      if (error instanceof ShopEditForbiddenError) {
        sendJson(res, 403, { error: error.message });
        return;
      }

      console.error('Shop API error:', error);
      sendJson(res, 500, { error: 'Internal server error' });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (pathname.startsWith('/rpc') && req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (await maybeProxyToFrontendDev(req, res, requestUrl)) {
    return;
  }

  const session = await getSession(req, {
    requestId,
    pathname,
    method,
    source: 'rpc',
  });
  const sessionSummary = summarizeSessionForLog(session);
  authDebugLog(requestId, 'rpc.dispatch', {
    method,
    pathname,
    sessionSummary,
  });

  const { matched } = await handler.handle(req, res, {
    prefix: '/rpc',
    context: {
      session,
      authDebug: {
        requestId,
        method,
        path: pathname,
        query: summarizeQueryForLogs(requestUrl.searchParams),
        cookieSummary: requestCookieSummary,
        sessionSummary,
      },
    },
  });

  if (!matched) {
    authDebugLog(requestId, 'rpc.not-matched', {
      method,
      pathname,
    });
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  authDebugLog(requestId, 'rpc.matched', {
    method,
    pathname,
    statusCode: res.statusCode,
  });
});

server.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
