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
};

function getSessionUserId(session: unknown): string | null {
  if (!session || typeof session !== 'object') {
    return null;
  }

  const maybeUser = (session as { user?: { id?: unknown } }).user;
  return typeof maybeUser?.id === 'string' ? maybeUser.id : null;
}

const protectedProcedure = os.$context<RouterContext>().use(({ context, next }) => {
  const userId = getSessionUserId(context.session);

  if (!userId) {
    throw new ORPCError('UNAUTHORIZED', {
      message: 'Unauthorized',
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
