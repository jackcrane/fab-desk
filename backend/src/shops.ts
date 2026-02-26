import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from './db';

type MembershipRole = 'ADMIN' | 'MEMBER';
type MembershipPolicy = 'invite-only' | 'domain';

const membershipPolicySchema = z.enum(['invite-only', 'domain']);

export interface ShopSummary {
  id: string;
  name: string;
  organization: string;
  role: MembershipRole;
  membershipPolicy: MembershipPolicy;
  membershipEmailDomain: string;
  primaryContactEmail: string;
  primaryContactEmailSource: 'shop' | 'admin-fallback';
}

const shopBasicSettingsInputSchema = z.object({
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

export const createShopInputSchema = shopBasicSettingsInputSchema.extend({
  membershipPolicy: membershipPolicySchema.default('invite-only'),
});

export const updateShopBasicSettingsInputSchema = shopBasicSettingsInputSchema;

export const updateShopAccessSettingsInputSchema = z.object({
  membershipPolicy: membershipPolicySchema,
});

type ShopMembershipRow = {
  id: string;
  name: string;
  organization: string;
  membershipPolicy: MembershipPolicy;
  membershipEmailDomain: string | null;
  primaryContactEmail: string | null;
  fallbackAdminEmail: string;
  role: MembershipRole;
};

function emailDomainFromAddress(email: string | null | undefined): string | null {
  if (typeof email !== 'string') {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const atIndex = normalizedEmail.lastIndexOf('@');

  if (atIndex <= 0 || atIndex === normalizedEmail.length - 1) {
    return null;
  }

  return normalizedEmail.slice(atIndex + 1);
}

function resolveMembershipEmailDomain(
  primaryContactEmail: string | null | undefined,
  adminEmail: string | null | undefined,
): string | null {
  return emailDomainFromAddress(primaryContactEmail) ?? emailDomainFromAddress(adminEmail);
}

function toShopSummary(record: ShopMembershipRow): ShopSummary {
  const contactEmail = record.primaryContactEmail ?? record.fallbackAdminEmail;

  return {
    id: record.id,
    name: record.name,
    organization: record.organization,
    role: record.role,
    membershipPolicy: record.membershipPolicy,
    membershipEmailDomain: record.membershipEmailDomain ?? '',
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
      s."membershipPolicy",
      s."membershipEmailDomain",
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
export type UpdateShopBasicSettingsInput = z.infer<typeof updateShopBasicSettingsInputSchema>;
export type UpdateShopAccessSettingsInput = z.infer<typeof updateShopAccessSettingsInputSchema>;

export class ShopNotFoundForUserError extends Error {
  constructor() {
    super('Shop not found for user');
    this.name = 'ShopNotFoundForUserError';
  }
}

export class ShopEditForbiddenError extends Error {
  constructor() {
    super('User cannot edit this shop');
    this.name = 'ShopEditForbiddenError';
  }
}

export class ShopAccessDomainUnavailableError extends Error {
  constructor() {
    super('Unable to derive allowed email domain. Set a primary contact email or use an admin account with a valid email.');
    this.name = 'ShopAccessDomainUnavailableError';
  }
}

export async function createShopForUser(userId: string, input: CreateShopInput): Promise<ShopSummary> {
  const shopId = randomUUID();
  const membershipId = randomUUID();
  const now = new Date();
  const primaryContactEmail = input.primaryContactEmail ?? null;
  const membershipPolicy = input.membershipPolicy;
  const adminRows = await prisma.$queryRaw<{ email: string }[]>`
    SELECT "email"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;
  const adminEmail = adminRows[0]?.email ?? null;
  const membershipEmailDomain =
    membershipPolicy === 'domain'
      ? resolveMembershipEmailDomain(primaryContactEmail, adminEmail)
      : null;

  if (membershipPolicy === 'domain' && !membershipEmailDomain) {
    throw new ShopAccessDomainUnavailableError();
  }

  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO "Shop" (
        "id",
        "name",
        "organization",
        "primaryContactEmail",
        "membershipPolicy",
        "membershipEmailDomain",
        "createdAt",
        "updatedAt",
        "createdById"
      )
      VALUES (
        ${shopId},
        ${input.name},
        ${input.organization},
        ${primaryContactEmail},
        ${membershipPolicy},
        ${membershipEmailDomain},
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
      s."membershipPolicy",
      s."membershipEmailDomain",
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

export async function updateShopBasicSettingsForUser(
  userId: string,
  shopId: string,
  input: UpdateShopBasicSettingsInput,
): Promise<ShopSummary> {
  const membershipRows = await prisma.$queryRaw<
    { role: MembershipRole; membershipPolicy: MembershipPolicy; adminEmail: string }[]
  >`
    SELECT
      m."role",
      s."membershipPolicy",
      u."email" AS "adminEmail"
    FROM "Membership" m
    INNER JOIN "Shop" s ON s."id" = m."shopId"
    INNER JOIN "User" u ON u."id" = m."userId"
    WHERE m."userId" = ${userId}
      AND m."shopId" = ${shopId}
    LIMIT 1
  `;

  const membership = membershipRows[0];

  if (!membership) {
    throw new ShopNotFoundForUserError();
  }

  if (membership.role !== 'ADMIN') {
    throw new ShopEditForbiddenError();
  }

  const now = new Date();
  const primaryContactEmail = input.primaryContactEmail ?? null;
  const membershipEmailDomain =
    membership.membershipPolicy === 'domain'
      ? resolveMembershipEmailDomain(primaryContactEmail, membership.adminEmail)
      : null;

  if (membership.membershipPolicy === 'domain' && !membershipEmailDomain) {
    throw new ShopAccessDomainUnavailableError();
  }

  const updatedRowCount = await prisma.$executeRaw`
    UPDATE "Shop"
    SET
      "name" = ${input.name},
      "organization" = ${input.organization},
      "primaryContactEmail" = ${primaryContactEmail},
      "membershipEmailDomain" = ${membershipEmailDomain},
      "updatedAt" = ${now}
    WHERE "id" = ${shopId}
  `;

  if (updatedRowCount === 0) {
    throw new ShopNotFoundForUserError();
  }

  const updatedMembershipRows = await prisma.$queryRaw<ShopMembershipRow[]>`
    SELECT
      s."id",
      s."name",
      s."organization",
      s."membershipPolicy",
      s."membershipEmailDomain",
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

  const updatedMembership = updatedMembershipRows[0];

  if (!updatedMembership) {
    throw new ShopNotFoundForUserError();
  }

  return toShopSummary(updatedMembership);
}

export async function updateShopAccessSettingsForUser(
  userId: string,
  shopId: string,
  input: UpdateShopAccessSettingsInput,
): Promise<ShopSummary> {
  const membershipRows = await prisma.$queryRaw<
    { role: MembershipRole; primaryContactEmail: string | null; adminEmail: string }[]
  >`
    SELECT
      m."role",
      s."primaryContactEmail",
      u."email" AS "adminEmail"
    FROM "Membership" m
    INNER JOIN "Shop" s ON s."id" = m."shopId"
    INNER JOIN "User" u ON u."id" = m."userId"
    WHERE m."userId" = ${userId}
      AND m."shopId" = ${shopId}
    LIMIT 1
  `;

  const membership = membershipRows[0];

  if (!membership) {
    throw new ShopNotFoundForUserError();
  }

  if (membership.role !== 'ADMIN') {
    throw new ShopEditForbiddenError();
  }

  const membershipEmailDomain =
    input.membershipPolicy === 'domain'
      ? resolveMembershipEmailDomain(membership.primaryContactEmail, membership.adminEmail)
      : null;

  if (input.membershipPolicy === 'domain' && !membershipEmailDomain) {
    throw new ShopAccessDomainUnavailableError();
  }

  const now = new Date();
  const updatedRowCount = await prisma.$executeRaw`
    UPDATE "Shop"
    SET
      "membershipPolicy" = ${input.membershipPolicy},
      "membershipEmailDomain" = ${membershipEmailDomain},
      "updatedAt" = ${now}
    WHERE "id" = ${shopId}
  `;

  if (updatedRowCount === 0) {
    throw new ShopNotFoundForUserError();
  }

  const updatedMembershipRows = await prisma.$queryRaw<ShopMembershipRow[]>`
    SELECT
      s."id",
      s."name",
      s."organization",
      s."membershipPolicy",
      s."membershipEmailDomain",
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

  const updatedMembership = updatedMembershipRows[0];

  if (!updatedMembership) {
    throw new ShopNotFoundForUserError();
  }

  return toShopSummary(updatedMembership);
}
