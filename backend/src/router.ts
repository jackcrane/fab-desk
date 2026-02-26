import { ORPCError, os } from '@orpc/server';
import { z } from 'zod';
import {
  createShopForUser,
  createShopInputSchema,
  listShopsForUser,
  ShopEditForbiddenError,
  ShopNotFoundForUserError,
  updateShopBasicSettingsForUser,
  updateShopBasicSettingsInputSchema,
} from './shops';

type RouterContext = {
  session: unknown;
  authDebug?: {
    requestId?: string;
    method?: string;
    path?: string;
    query?: unknown;
    cookieSummary?: unknown;
    sessionSummary?: unknown;
  };
};

const authDebugEnabled =
  String(process.env.AUTH_DEBUG_LOGS ?? process.env.NODE_ENV !== 'production')
    .trim()
    .toLowerCase() !== 'false';

function getSessionUserId(session: unknown): string | null {
  if (!session || typeof session !== 'object') {
    return null;
  }

  const maybeUser = (session as { user?: { id?: unknown } }).user;
  return typeof maybeUser?.id === 'string' ? maybeUser.id : null;
}

function summarizeSessionForLog(session: unknown): Record<string, unknown> {
  if (!session || typeof session !== 'object') {
    return { present: false };
  }

  const maybeSession = session as { user?: { id?: unknown; email?: unknown }; session?: { id?: unknown } };

  return {
    present: true,
    topLevelKeys: Object.keys(session as Record<string, unknown>),
    userId: typeof maybeSession.user?.id === 'string' ? maybeSession.user.id : null,
    userEmail: typeof maybeSession.user?.email === 'string' ? maybeSession.user.email : null,
    sessionId: typeof maybeSession.session?.id === 'string' ? maybeSession.session.id : null,
  };
}

const protectedProcedure = os.$context<RouterContext>().use(({ context, next }) => {
  const userId = getSessionUserId(context.session);

  if (!userId) {
    if (authDebugEnabled) {
      console.error('[auth-debug] oRPC auth guard denied request', {
        requestId: context.authDebug?.requestId ?? null,
        method: context.authDebug?.method ?? null,
        path: context.authDebug?.path ?? null,
        query: context.authDebug?.query ?? null,
        cookieSummary: context.authDebug?.cookieSummary ?? null,
        sessionSummary: context.authDebug?.sessionSummary ?? summarizeSessionForLog(context.session),
      });
    }

    throw new ORPCError('UNAUTHORIZED', {
      message: 'Unauthorized',
    });
  }

  if (authDebugEnabled) {
    console.log('[auth-debug] oRPC auth guard authorized request', {
      requestId: context.authDebug?.requestId ?? null,
      method: context.authDebug?.method ?? null,
      path: context.authDebug?.path ?? null,
      userId,
    });
  }

  return next({
    context: {
      ...context,
      userId,
    },
  });
});

const updateShopBasicSettingsProcedureInputSchema = updateShopBasicSettingsInputSchema.extend({
  shopId: z.string().trim().min(1),
});

const list = protectedProcedure.handler(async ({ context }) => {
  return listShopsForUser(context.userId);
});

const create = protectedProcedure
  .input(createShopInputSchema)
  .handler(async ({ context, input }) => {
    return createShopForUser(context.userId, input);
  });

const updateBasicSettings = protectedProcedure
  .input(updateShopBasicSettingsProcedureInputSchema)
  .handler(async ({ context, input }) => {
    const { shopId, ...settings } = input;

    try {
      return await updateShopBasicSettingsForUser(context.userId, shopId, settings);
    } catch (error) {
      if (error instanceof ShopNotFoundForUserError) {
        throw new ORPCError('NOT_FOUND', {
          message: error.message,
        });
      }

      if (error instanceof ShopEditForbiddenError) {
        throw new ORPCError('FORBIDDEN', {
          message: error.message,
        });
      }

      throw error;
    }
  });

export const router = {
  shop: {
    list,
    create,
    updateBasicSettings,
  },
};

export type AppRouter = typeof router;
