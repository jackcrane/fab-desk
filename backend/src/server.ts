import 'dotenv/config';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { onError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/node';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth';
import { prisma } from './db';
import { router } from './router';

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

const server = createServer(async (req, res) => {
  if (req.headers.origin === frontendOrigin) {
    withAuthCors(req, res);
  }

  if (req.url?.startsWith('/api/auth')) {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    await authHandler(req, res);
    return;
  }

  if (req.url?.startsWith('/rpc') && req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.url === '/health') {
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
