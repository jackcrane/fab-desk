import { ORPCError, os } from '@orpc/server';
import { z } from 'zod';
import {
  createShopForUser,
  createShopInputSchema,
  listShopsForUser,
  ShopAccessDomainUnavailableError,
  ShopEditForbiddenError,
  ShopNotFoundForUserError,
  updateShopAccessSettingsForUser,
  updateShopAccessSettingsInputSchema,
  updateShopBasicSettingsForUser,
  updateShopBasicSettingsInputSchema,
} from './shops';
import {
  createShopProcessMaterialForUser,
  createShopProcessMaterialInputSchema,
  deleteShopProcessForUser,
  deleteShopProcessInputSchema,
  createShopProcessForUser,
  createShopProcessInputSchema,
  createShopProcessResourceForUser,
  createShopProcessResourceInputSchema,
  listShopProcessCatalogForUser,
  listShopProcessCatalogInputSchema,
  ShopProcessEditForbiddenError,
  ShopProcessMaterialNameAlreadyExistsError,
  ShopProcessNotFoundForUserError,
  ShopProcessNameAlreadyExistsError,
  ShopProcessResourceNameAlreadyExistsError,
  updateShopProcessForUser,
  updateShopProcessInputSchema,
  ShopNotFoundForUserError as ProcessCatalogShopNotFoundForUserError,
  ShopProcessCatalogSchemaNotReadyError,
} from './shop-processes';
import {
  createJobUploadTargetsForUser,
  createJobUploadTargetsInputSchema,
  createJobForUser,
  createJobInputSchema,
  JobNotFoundForUserError,
  JobsSchemaNotReadyError,
  listShopJobsForUser,
  listShopJobsInputSchema,
  ShopNotFoundForUserError as JobShopNotFoundForUserError,
  UploadStorageConfigError,
  updateJobStatusForUser,
  updateJobStatusInputSchema,
} from './jobs';

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
const updateShopAccessSettingsProcedureInputSchema = updateShopAccessSettingsInputSchema.extend({
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

      if (error instanceof ShopAccessDomainUnavailableError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }

      throw error;
    }
  });

const updateAccessSettings = protectedProcedure
  .input(updateShopAccessSettingsProcedureInputSchema)
  .handler(async ({ context, input }) => {
    const { shopId, ...settings } = input;

    try {
      return await updateShopAccessSettingsForUser(context.userId, shopId, settings);
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

      if (error instanceof ShopAccessDomainUnavailableError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }

      throw error;
    }
  });

const listProcessCatalog = protectedProcedure
  .input(listShopProcessCatalogInputSchema)
  .handler(async ({ context, input }) => {
    try {
      return await listShopProcessCatalogForUser(context.userId, input.shopId);
    } catch (error) {
      if (error instanceof ProcessCatalogShopNotFoundForUserError) {
        throw new ORPCError('NOT_FOUND', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessCatalogSchemaNotReadyError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }

      throw error;
    }
  });

const createProcess = protectedProcedure
  .input(createShopProcessInputSchema)
  .handler(async ({ context, input }) => {
    try {
      return await createShopProcessForUser(context.userId, input);
    } catch (error) {
      if (error instanceof ProcessCatalogShopNotFoundForUserError) {
        throw new ORPCError('NOT_FOUND', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessEditForbiddenError) {
        throw new ORPCError('FORBIDDEN', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessNameAlreadyExistsError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessCatalogSchemaNotReadyError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }

      throw error;
    }
  });

const createResource = protectedProcedure
  .input(createShopProcessResourceInputSchema)
  .handler(async ({ context, input }) => {
    try {
      return await createShopProcessResourceForUser(context.userId, input);
    } catch (error) {
      if (error instanceof ProcessCatalogShopNotFoundForUserError || error instanceof ShopProcessNotFoundForUserError) {
        throw new ORPCError('NOT_FOUND', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessEditForbiddenError) {
        throw new ORPCError('FORBIDDEN', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessResourceNameAlreadyExistsError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessCatalogSchemaNotReadyError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }

      throw error;
    }
  });

const createMaterial = protectedProcedure
  .input(createShopProcessMaterialInputSchema)
  .handler(async ({ context, input }) => {
    try {
      return await createShopProcessMaterialForUser(context.userId, input);
    } catch (error) {
      if (error instanceof ProcessCatalogShopNotFoundForUserError || error instanceof ShopProcessNotFoundForUserError) {
        throw new ORPCError('NOT_FOUND', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessEditForbiddenError) {
        throw new ORPCError('FORBIDDEN', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessMaterialNameAlreadyExistsError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessCatalogSchemaNotReadyError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }

      throw error;
    }
  });

const updateProcess = protectedProcedure
  .input(updateShopProcessInputSchema)
  .handler(async ({ context, input }) => {
    try {
      return await updateShopProcessForUser(context.userId, input);
    } catch (error) {
      if (error instanceof ProcessCatalogShopNotFoundForUserError || error instanceof ShopProcessNotFoundForUserError) {
        throw new ORPCError('NOT_FOUND', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessEditForbiddenError) {
        throw new ORPCError('FORBIDDEN', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessNameAlreadyExistsError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessCatalogSchemaNotReadyError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }

      throw error;
    }
  });

const deleteProcess = protectedProcedure
  .input(deleteShopProcessInputSchema)
  .handler(async ({ context, input }) => {
    try {
      return await deleteShopProcessForUser(context.userId, input);
    } catch (error) {
      if (error instanceof ProcessCatalogShopNotFoundForUserError || error instanceof ShopProcessNotFoundForUserError) {
        throw new ORPCError('NOT_FOUND', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessEditForbiddenError) {
        throw new ORPCError('FORBIDDEN', {
          message: error.message,
        });
      }
      if (error instanceof ShopProcessCatalogSchemaNotReadyError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }

      throw error;
    }
  });

const listByShop = protectedProcedure
  .input(listShopJobsInputSchema)
  .handler(async ({ context, input }) => {
    try {
      return await listShopJobsForUser(context.userId, input.shopId);
    } catch (error) {
      if (error instanceof JobShopNotFoundForUserError) {
        throw new ORPCError('NOT_FOUND', {
          message: error.message,
        });
      }
      if (error instanceof JobsSchemaNotReadyError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }

      throw error;
    }
  });

const createJob = protectedProcedure
  .input(createJobInputSchema)
  .handler(async ({ context, input }) => {
    try {
      return await createJobForUser(context.userId, input);
    } catch (error) {
      if (error instanceof JobShopNotFoundForUserError) {
        throw new ORPCError('NOT_FOUND', {
          message: error.message,
        });
      }
      if (error instanceof JobsSchemaNotReadyError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }

      throw error;
    }
  });

const createUploadTargets = protectedProcedure
  .input(createJobUploadTargetsInputSchema)
  .handler(async ({ context, input }) => {
    try {
      return await createJobUploadTargetsForUser(context.userId, input);
    } catch (error) {
      if (error instanceof JobShopNotFoundForUserError || error instanceof JobNotFoundForUserError) {
        throw new ORPCError('NOT_FOUND', {
          message: error.message,
        });
      }
      if (error instanceof JobsSchemaNotReadyError) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
        });
      }
      if (error instanceof UploadStorageConfigError) {
        throw new ORPCError('INTERNAL_SERVER_ERROR', {
          message: error.message,
        });
      }

      throw error;
    }
  });

const updateStatus = protectedProcedure
  .input(updateJobStatusInputSchema)
  .handler(async ({ context, input }) => {
    try {
      return await updateJobStatusForUser(context.userId, input.shopId, input.jobId, input.status);
    } catch (error) {
      if (error instanceof JobShopNotFoundForUserError || error instanceof JobNotFoundForUserError) {
        throw new ORPCError('NOT_FOUND', {
          message: error.message,
        });
      }
      if (error instanceof JobsSchemaNotReadyError) {
        throw new ORPCError('BAD_REQUEST', {
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
    updateAccessSettings,
    listProcessCatalog,
    createProcess,
    createResource,
    createMaterial,
    updateProcess,
    deleteProcess,
  },
  job: {
    listByShop,
    create: createJob,
    createUploadTargets,
    updateStatus,
  },
};

export type AppRouter = typeof router;
