import 'dotenv/config';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { onError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/node';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth';
import { prisma } from './db';
import { router } from './router';
import {
  createShopForUser,
  createShopInputSchema,
  listShopsForUser,
  ShopEditForbiddenError,
  ShopNotFoundForUserError,
  updateShopBasicSettingsForUser,
  updateShopBasicSettingsInputSchema,
} from './shops';

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error('oRPC error:', error);
    }),
  ],
});

const authHandler = toNodeHandler(auth);

const port = Number(process.env.PORT ?? 3000);

function withAuthCors(req: IncomingMessage, res: ServerResponse): void {
  const requestedHeaders = req.headers['access-control-request-headers'];

  res.setHeader('Access-Control-Allow-Origin', frontendOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Headers',
    requestedHeaders ?? 'content-type, authorization',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = requestUrl.pathname;

  if (req.headers.origin === frontendOrigin) {
    withAuthCors(req, res);
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

    // Mocked for now: every domain proceeds with password auth.
    sendJson(res, 200, {
      domain,
      requiresSso: false,
      ssoProvider: null,
    });
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

  const session = await getSession(req);

  const { matched } = await handler.handle(req, res, {
    prefix: '/rpc',
    context: { session },
  });

  if (!matched) {
    res.statusCode = 404;
    res.end('Not found');
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
