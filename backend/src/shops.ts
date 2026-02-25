import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from './db';

type MembershipRole = 'ADMIN' | 'MEMBER';

export interface ShopSummary {
  id: string;
  name: string;
  organization: string;
  role: MembershipRole;
  primaryContactEmail: string;
  primaryContactEmailSource: 'shop' | 'admin-fallback';
}

export const createShopInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  organization: z.string().trim().min(1).max(120),
  primaryContactEmail: z.preprocess(
    (value) => {
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    },
    z.string().trim().email().max(255).optional(),
  ),
});

type ShopMembershipRow = {
  id: string;
  name: string;
  organization: string;
  primaryContactEmail: string | null;
  fallbackAdminEmail: string;
  role: MembershipRole;
};

function toShopSummary(record: ShopMembershipRow): ShopSummary {
  const contactEmail = record.primaryContactEmail ?? record.fallbackAdminEmail;

  return {
    id: record.id,
    name: record.name,
    organization: record.organization,
    role: record.role,
    primaryContactEmail: contactEmail,
    primaryContactEmailSource: record.primaryContactEmail ? 'shop' : 'admin-fallback',
  };
}

export async function listShopsForUser(userId: string): Promise<ShopSummary[]> {
  const memberships = await prisma.$queryRaw<ShopMembershipRow[]>`
    SELECT
      s."id",
      s."name",
      s."organization",
      s."primaryContactEmail",
      creator."email" AS "fallbackAdminEmail",
      m."role"
    FROM "Membership" m
    INNER JOIN "Shop" s ON s."id" = m."shopId"
    INNER JOIN "User" creator ON creator."id" = s."createdById"
    WHERE m."userId" = ${userId}
    ORDER BY m."createdAt" ASC
  `;

  return memberships.map(toShopSummary);
}

export type CreateShopInput = z.infer<typeof createShopInputSchema>;

export async function createShopForUser(userId: string, input: CreateShopInput): Promise<ShopSummary> {
  const shopId = randomUUID();
  const membershipId = randomUUID();
  const now = new Date();
  const primaryContactEmail = input.primaryContactEmail ?? null;

  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO "Shop" (
        "id",
        "name",
        "organization",
        "primaryContactEmail",
        "createdAt",
        "updatedAt",
        "createdById"
      )
      VALUES (
        ${shopId},
        ${input.name},
        ${input.organization},
        ${primaryContactEmail},
        ${now},
        ${now},
        ${userId}
      )
    `,
    prisma.$executeRaw`
      INSERT INTO "Membership" (
        "id",
        "role",
        "createdAt",
        "updatedAt",
        "userId",
        "shopId"
      )
      VALUES (
        ${membershipId},
        'ADMIN',
        ${now},
        ${now},
        ${userId},
        ${shopId}
      )
    `,
  ]);

  const createdMembershipRows = await prisma.$queryRaw<ShopMembershipRow[]>`
    SELECT
      s."id",
      s."name",
      s."organization",
      s."primaryContactEmail",
      creator."email" AS "fallbackAdminEmail",
      m."role"
    FROM "Membership" m
    INNER JOIN "Shop" s ON s."id" = m."shopId"
    INNER JOIN "User" creator ON creator."id" = s."createdById"
    WHERE m."userId" = ${userId}
      AND m."shopId" = ${shopId}
    LIMIT 1
  `;

  const createdMembership = createdMembershipRows[0];

  if (!createdMembership) {
    throw new Error('Failed to create shop membership');
  }

  return toShopSummary(createdMembership);
}
