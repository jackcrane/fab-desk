import 'dotenv/config';
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

async function getSession(req: IncomingMessage) {
  return auth.api.getSession({
    headers: new Headers(req.headers as HeadersInit),
  });
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

  const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : null;
  const requestHost = typeof req.headers.host === 'string' ? req.headers.host.trim() : null;
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
    const authResponse = await auth.api.signInSSO({
      body: signInBody as any,
      headers: new Headers(req.headers as HeadersInit),
      asResponse: true,
    });
    const responseBody = await authResponse.text();

    applyWebResponseHeaders(authResponse.headers, res);

    if (!authResponse.ok || !shouldUsePostBinding) {
      res.statusCode = authResponse.status;
      res.end(responseBody);
      return;
    }

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(responseBody);
    } catch {
      res.statusCode = authResponse.status;
      res.end(responseBody);
      return;
    }

    const transformedResponse = toSamlPostRedirectPayload(parsedResponse);
    if (!transformedResponse) {
      res.statusCode = authResponse.status;
      res.end(responseBody);
      return;
    }

    sendJson(res, authResponse.status, transformedResponse);
    return;
  }

  if (pathname.startsWith('/api/auth')) {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    await authHandler(req, res);
    return;
  }

  if (pathname.startsWith('/api/shops') && req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (pathname === '/api/shops') {
    const session = await getSession(req);
    const userId = getSessionUserId(session);

    if (!userId) {
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
    const session = await getSession(req);
    const userId = getSessionUserId(session);

    if (!userId) {
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

  const session = await getSession(req);

  const { matched } = await handler.handle(req, res, {
    prefix: '/rpc',
    context: { session },
  });

  if (!matched) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
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
