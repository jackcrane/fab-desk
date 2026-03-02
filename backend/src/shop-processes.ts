import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from './db';

export const listShopProcessCatalogInputSchema = z.object({
  shopId: z.string().trim().min(1),
});

export const createShopProcessInputSchema = z.object({
  shopId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.preprocess(
    (value) => {
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    },
    z.string().trim().max(1000).optional(),
  ),
});

const processCostInputSchema = z
  .number()
  .finite()
  .min(0, { message: 'Cost values must be 0 or greater.' });

export const createShopProcessResourceInputSchema = z.object({
  shopId: z.string().trim().min(1),
  processId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.preprocess(
    (value) => {
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    },
    z.string().trim().max(1000).optional(),
  ),
  unit: z.string().trim().min(1).max(80),
  costPerUnit: processCostInputSchema,
  flatCost: processCostInputSchema,
});

export const createShopProcessMaterialInputSchema = z.object({
  shopId: z.string().trim().min(1),
  processId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.preprocess(
    (value) => {
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    },
    z.string().trim().max(1000).optional(),
  ),
  unit: z.string().trim().min(1).max(80),
  costPerUnit: processCostInputSchema,
  flatCost: processCostInputSchema,
});

export interface ShopProcessResource {
  id: string;
  name: string;
  description: string;
  unit: string;
  costPerUnit: number;
  flatCost: number;
}

export interface ShopProcessMaterial {
  id: string;
  name: string;
  description: string;
  unit: string;
  costPerUnit: number;
  flatCost: number;
}

export interface ShopProcessCatalogItem {
  id: string;
  name: string;
  description: string;
  resources: ShopProcessResource[];
  materials: ShopProcessMaterial[];
}

export interface ShopProcessCatalogList {
  processes: ShopProcessCatalogItem[];
}

type ShopMembershipRow = {
  id: string;
};

type ShopMembershipRole = 'ADMIN' | 'STAFF' | 'MEMBER';

type ShopMembershipRoleRow = {
  role: ShopMembershipRole;
};

type ShopProcessRow = {
  id: string;
  name: string;
  description: string;
};

type ShopProcessResourceRow = {
  id: string;
  processId: string;
  name: string;
  description: string;
  unit: string;
  costPerUnit: number | string;
  flatCost: number | string;
};

type ShopProcessMaterialRow = {
  id: string;
  processId: string;
  name: string;
  description: string;
  unit: string;
  costPerUnit: number | string;
  flatCost: number | string;
};

type ShopProcessLookupRow = {
  id: string;
};

export class ShopNotFoundForUserError extends Error {
  constructor() {
    super('Shop not found for user');
    this.name = 'ShopNotFoundForUserError';
  }
}

export class ShopProcessCatalogSchemaNotReadyError extends Error {
  constructor() {
    super(
      'Shop process, resource, and material tables are not available yet. Run your pending Prisma migration before using this API.',
    );
    this.name = 'ShopProcessCatalogSchemaNotReadyError';
  }
}

export class ShopProcessEditForbiddenError extends Error {
  constructor() {
    super('Only shop admins can edit process setup');
    this.name = 'ShopProcessEditForbiddenError';
  }
}

export class ShopProcessNameAlreadyExistsError extends Error {
  constructor() {
    super('A process with this name already exists for this shop');
    this.name = 'ShopProcessNameAlreadyExistsError';
  }
}

export class ShopProcessNotFoundForUserError extends Error {
  constructor() {
    super('Process not found for shop');
    this.name = 'ShopProcessNotFoundForUserError';
  }
}

export class ShopProcessResourceNameAlreadyExistsError extends Error {
  constructor() {
    super('A resource with this name already exists for this process');
    this.name = 'ShopProcessResourceNameAlreadyExistsError';
  }
}

export class ShopProcessMaterialNameAlreadyExistsError extends Error {
  constructor() {
    super('A material with this name already exists for this process');
    this.name = 'ShopProcessMaterialNameAlreadyExistsError';
  }
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: unknown }).code === '42P01';
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: unknown }).code === '23505';
}

function toNumber(value: number | string): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error('Invalid numeric value returned from database');
  }

  return numeric;
}

async function ensureShopMembership(userId: string, shopId: string): Promise<void> {
  const membershipRows = await prisma.$queryRaw<ShopMembershipRow[]>`
    SELECT "id"
    FROM "Membership"
    WHERE "userId" = ${userId}
      AND "shopId" = ${shopId}
    LIMIT 1
  `;

  if (!membershipRows[0]) {
    throw new ShopNotFoundForUserError();
  }
}

async function getShopMembershipRole(
  userId: string,
  shopId: string,
): Promise<ShopMembershipRole> {
  const membershipRows = await prisma.$queryRaw<ShopMembershipRoleRow[]>`
    SELECT "role"
    FROM "Membership"
    WHERE "userId" = ${userId}
      AND "shopId" = ${shopId}
    LIMIT 1
  `;

  const membership = membershipRows[0];
  if (!membership) {
    throw new ShopNotFoundForUserError();
  }

  return membership.role;
}

export type CreateShopProcessInput = z.infer<typeof createShopProcessInputSchema>;
export type CreateShopProcessResourceInput = z.infer<typeof createShopProcessResourceInputSchema>;
export type CreateShopProcessMaterialInput = z.infer<typeof createShopProcessMaterialInputSchema>;

export async function createShopProcessForUser(
  userId: string,
  input: CreateShopProcessInput,
): Promise<ShopProcessCatalogItem> {
  try {
    const membershipRole = await getShopMembershipRole(userId, input.shopId);
    if (membershipRole !== 'ADMIN') {
      throw new ShopProcessEditForbiddenError();
    }

    const processId = randomUUID();
    const now = new Date();
    const description = input.description ?? null;

    await prisma.$executeRaw`
      INSERT INTO "ShopProcess" (
        "id",
        "shopId",
        "name",
        "description",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${processId},
        ${input.shopId},
        ${input.name},
        ${description},
        ${now},
        ${now}
      )
    `;

    return {
      id: processId,
      name: input.name,
      description: description ?? '',
      resources: [],
      materials: [],
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new ShopProcessCatalogSchemaNotReadyError();
    }
    if (isUniqueConstraintError(error)) {
      throw new ShopProcessNameAlreadyExistsError();
    }

    throw error;
  }
}

async function ensureProcessBelongsToShop(processId: string, shopId: string): Promise<void> {
  const processRows = await prisma.$queryRaw<ShopProcessLookupRow[]>`
    SELECT "id"
    FROM "ShopProcess"
    WHERE "id" = ${processId}
      AND "shopId" = ${shopId}
    LIMIT 1
  `;

  if (!processRows[0]) {
    throw new ShopProcessNotFoundForUserError();
  }
}

export async function createShopProcessResourceForUser(
  userId: string,
  input: CreateShopProcessResourceInput,
): Promise<ShopProcessResource> {
  try {
    const membershipRole = await getShopMembershipRole(userId, input.shopId);
    if (membershipRole !== 'ADMIN') {
      throw new ShopProcessEditForbiddenError();
    }

    await ensureProcessBelongsToShop(input.processId, input.shopId);

    const resourceId = randomUUID();
    const now = new Date();
    const description = input.description ?? null;

    await prisma.$executeRaw`
      INSERT INTO "ProcessResource" (
        "id",
        "processId",
        "name",
        "description",
        "unit",
        "costPerUnit",
        "flatCost",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${resourceId},
        ${input.processId},
        ${input.name},
        ${description},
        ${input.unit},
        ${input.costPerUnit},
        ${input.flatCost},
        ${now},
        ${now}
      )
    `;

    return {
      id: resourceId,
      name: input.name,
      description: description ?? '',
      unit: input.unit,
      costPerUnit: input.costPerUnit,
      flatCost: input.flatCost,
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new ShopProcessCatalogSchemaNotReadyError();
    }
    if (isUniqueConstraintError(error)) {
      throw new ShopProcessResourceNameAlreadyExistsError();
    }

    throw error;
  }
}

export async function createShopProcessMaterialForUser(
  userId: string,
  input: CreateShopProcessMaterialInput,
): Promise<ShopProcessMaterial> {
  try {
    const membershipRole = await getShopMembershipRole(userId, input.shopId);
    if (membershipRole !== 'ADMIN') {
      throw new ShopProcessEditForbiddenError();
    }

    await ensureProcessBelongsToShop(input.processId, input.shopId);

    const materialId = randomUUID();
    const now = new Date();
    const description = input.description ?? null;

    await prisma.$executeRaw`
      INSERT INTO "ProcessMaterial" (
        "id",
        "processId",
        "name",
        "description",
        "unit",
        "costPerUnit",
        "flatCost",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${materialId},
        ${input.processId},
        ${input.name},
        ${description},
        ${input.unit},
        ${input.costPerUnit},
        ${input.flatCost},
        ${now},
        ${now}
      )
    `;

    return {
      id: materialId,
      name: input.name,
      description: description ?? '',
      unit: input.unit,
      costPerUnit: input.costPerUnit,
      flatCost: input.flatCost,
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new ShopProcessCatalogSchemaNotReadyError();
    }
    if (isUniqueConstraintError(error)) {
      throw new ShopProcessMaterialNameAlreadyExistsError();
    }

    throw error;
  }
}

export async function listShopProcessCatalogForUser(
  userId: string,
  shopId: string,
): Promise<ShopProcessCatalogList> {
  try {
    await ensureShopMembership(userId, shopId);

    const processRows = await prisma.$queryRaw<ShopProcessRow[]>`
      SELECT
        sp."id",
        sp."name",
        COALESCE(sp."description", '') AS "description"
      FROM "ShopProcess" sp
      WHERE sp."shopId" = ${shopId}
      ORDER BY sp."createdAt" ASC, sp."name" ASC
    `;

    if (processRows.length === 0) {
      return { processes: [] };
    }

    const resourceRows = await prisma.$queryRaw<ShopProcessResourceRow[]>`
      SELECT
        pr."id",
        pr."processId",
        pr."name",
        COALESCE(pr."description", '') AS "description",
        pr."unit",
        pr."costPerUnit",
        pr."flatCost"
      FROM "ProcessResource" pr
      INNER JOIN "ShopProcess" sp ON sp."id" = pr."processId"
      WHERE sp."shopId" = ${shopId}
      ORDER BY pr."createdAt" ASC, pr."name" ASC
    `;

    const materialRows = await prisma.$queryRaw<ShopProcessMaterialRow[]>`
      SELECT
        pm."id",
        pm."processId",
        pm."name",
        COALESCE(pm."description", '') AS "description",
        pm."unit",
        pm."costPerUnit",
        pm."flatCost"
      FROM "ProcessMaterial" pm
      INNER JOIN "ShopProcess" sp ON sp."id" = pm."processId"
      WHERE sp."shopId" = ${shopId}
      ORDER BY pm."createdAt" ASC, pm."name" ASC
    `;

    const resourcesByProcessId = new Map<string, ShopProcessResource[]>();
    for (const resource of resourceRows) {
      const currentResources = resourcesByProcessId.get(resource.processId) ?? [];
      currentResources.push({
        id: resource.id,
        name: resource.name,
        description: resource.description,
        unit: resource.unit,
        costPerUnit: toNumber(resource.costPerUnit),
        flatCost: toNumber(resource.flatCost),
      });
      resourcesByProcessId.set(resource.processId, currentResources);
    }

    const materialsByProcessId = new Map<string, ShopProcessMaterial[]>();
    for (const material of materialRows) {
      const currentMaterials = materialsByProcessId.get(material.processId) ?? [];
      currentMaterials.push({
        id: material.id,
        name: material.name,
        description: material.description,
        unit: material.unit,
        costPerUnit: toNumber(material.costPerUnit),
        flatCost: toNumber(material.flatCost),
      });
      materialsByProcessId.set(material.processId, currentMaterials);
    }

    return {
      processes: processRows.map((process) => ({
        id: process.id,
        name: process.name,
        description: process.description,
        resources: resourcesByProcessId.get(process.id) ?? [],
        materials: materialsByProcessId.get(process.id) ?? [],
      })),
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new ShopProcessCatalogSchemaNotReadyError();
    }

    throw error;
  }
}
