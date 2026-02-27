import { randomUUID } from 'node:crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { z } from 'zod';
import { prisma } from './db';

export const jobStatusSchema = z.enum([
  'DRAFT',
  'QUEUED',
  'IN_PRODUCTION',
  'BLOCKED',
  'COMPLETED',
  'READY_FOR_PICKUP',
]);
export const jobPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const jobPartStatusSchema = z.enum(['QUEUED', 'RUNNING', 'BLOCKED', 'QA', 'DONE']);

export type JobStatus = z.infer<typeof jobStatusSchema>;
export type JobPriority = z.infer<typeof jobPrioritySchema>;
export type JobPartStatus = z.infer<typeof jobPartStatusSchema>;

export interface JobPartSummary {
  id: string;
  code: string;
  name: string;
  process: string;
  material: string;
  machine: string;
  quantity: number;
  status: JobPartStatus;
}

export interface ShopJobSummary {
  id: string;
  name: string;
  customer: string;
  category: string;
  status: JobStatus;
  priority: JobPriority;
  dueDate: string;
  assignee: string;
  parts: JobPartSummary[];
}

export interface ShopJobsList {
  jobs: ShopJobSummary[];
}

export interface UpdateJobStatusResult {
  id: string;
  status: JobStatus;
}

export interface JobUploadTarget {
  fileName: string;
  objectKey: string;
  uploadUrl: string;
  uploadFields: Record<string, string>;
}

export interface CreateJobUploadTargetsResult {
  uploads: JobUploadTarget[];
  maxFileSizeBytes: number;
}

const MAX_UPLOAD_FILE_SIZE_BYTES = 1024 * 1024 * 1024;
const MAX_UPLOAD_FILE_COUNT = 25;

function parseDateOnlyToUtc(dateValue: string): Date {
  const [yearPart, monthPart, dayPart] = dateValue.split('-');

  return new Date(Date.UTC(Number(yearPart), Number(monthPart) - 1, Number(dayPart)));
}

function isValidDateOnlyString(dateValue: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return false;
  }

  const parsedDate = parseDateOnlyToUtc(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  const [yearPart, monthPart, dayPart] = dateValue.split('-').map((part) => Number(part));

  return (
    parsedDate.getUTCFullYear() === yearPart &&
    parsedDate.getUTCMonth() + 1 === monthPart &&
    parsedDate.getUTCDate() === dayPart
  );
}

export const listShopJobsInputSchema = z.object({
  shopId: z.string().trim().min(1),
});

export const createJobInputSchema = z.object({
  shopId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(160),
  status: jobStatusSchema.default('DRAFT'),
  priority: jobPrioritySchema.default('MEDIUM'),
  dueDate: z.string().trim().refine(isValidDateOnlyString, {
    message: 'Due date must be a valid date in YYYY-MM-DD format.',
  }),
});

export const updateJobStatusInputSchema = z.object({
  shopId: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  status: jobStatusSchema,
});

const createJobUploadFileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  size: z.number().int().min(1).max(MAX_UPLOAD_FILE_SIZE_BYTES),
  contentType: z.string().trim().min(1).max(255).optional(),
});

export const createJobUploadTargetsInputSchema = z.object({
  shopId: z.string().trim().min(1),
  files: z.array(createJobUploadFileSchema).min(1).max(MAX_UPLOAD_FILE_COUNT),
});

type JobRow = {
  id: string;
  name: string;
  customer: string;
  category: string;
  status: JobStatus;
  priority: JobPriority;
  dueDate: Date;
  assignee: string;
  createdAt: Date;
};

type JobPartRow = {
  id: string;
  jobId: string;
  code: string;
  name: string;
  process: string;
  material: string;
  machine: string;
  quantity: number;
  status: JobPartStatus;
  createdAt: Date;
};

type ShopMembershipForJobRow = {
  membershipId: string;
  displayName: string;
};

type JobAccessRow = {
  id: string;
};

type UploadStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  projectName: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type PresignedPostCondition =
  | ['content-length-range', number, number]
  | ['eq', string, string]
  | Record<string, string>;

let cachedUploadStorageConfig: UploadStorageConfig | null = null;
let cachedUploadS3Client: S3Client | null = null;

export class ShopNotFoundForUserError extends Error {
  constructor() {
    super('Shop not found for user');
    this.name = 'ShopNotFoundForUserError';
  }
}

export class JobNotFoundForUserError extends Error {
  constructor() {
    super('Job not found for user');
    this.name = 'JobNotFoundForUserError';
  }
}

export class JobsSchemaNotReadyError extends Error {
  constructor() {
    super(
      'Jobs tables are not available yet. Run Prisma migration + generate for backend before using jobs APIs.',
    );
    this.name = 'JobsSchemaNotReadyError';
  }
}

export class UploadStorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadStorageConfigError';
  }
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function sanitizePathSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}

function sanitizeFileName(fileName: string): string {
  const nameWithoutPath = fileName.split(/[\\/]/).pop() ?? 'file';
  const normalized = nameWithoutPath
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 180);

  return normalized.length > 0 ? normalized : 'file';
}

function getUploadStorageConfig(): UploadStorageConfig {
  if (cachedUploadStorageConfig) {
    return cachedUploadStorageConfig;
  }

  const endpoint = process.env.AWS_ENDPOINT?.trim() ?? '';
  const region = process.env.AWS_REGION?.trim() ?? '';
  const bucket = process.env.AWS_BUCKET?.trim() ?? '';
  const projectName = sanitizePathSegment(process.env.PROJECT_NAME?.trim() ?? '');
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim() ?? '';
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim() ?? '';

  if (!endpoint || !region || !bucket || !projectName || !accessKeyId || !secretAccessKey) {
    throw new UploadStorageConfigError(
      'Missing required AWS upload configuration. Ensure AWS_ENDPOINT, AWS_REGION, AWS_BUCKET, PROJECT_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY are set.',
    );
  }

  cachedUploadStorageConfig = {
    endpoint,
    region,
    bucket,
    projectName,
    accessKeyId,
    secretAccessKey,
  };

  return cachedUploadStorageConfig;
}

function getUploadS3Client(config: UploadStorageConfig): S3Client {
  if (cachedUploadS3Client) {
    return cachedUploadS3Client;
  }

  cachedUploadS3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: false,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedUploadS3Client;
}

function buildUploadObjectKey(
  projectName: string,
  shopId: string,
  originalFileName: string,
): string {
  const safeFileName = sanitizeFileName(originalFileName);
  const nonce = randomUUID();

  return `${projectName}/jobs/uploads/${shopId}/${nonce}-${safeFileName}`;
}

async function ensureShopMembership(userId: string, shopId: string): Promise<void> {
  const membershipRows = await prisma.$queryRaw<{ id: string }[]>`
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

async function ensureJobAccess(userId: string, shopId: string, jobId: string): Promise<void> {
  const jobAccessRows = await prisma.$queryRaw<JobAccessRow[]>`
    SELECT j."id"
    FROM "Job" j
    INNER JOIN "Membership" m ON m."shopId" = j."shopId"
    WHERE j."id" = ${jobId}
      AND j."shopId" = ${shopId}
      AND m."userId" = ${userId}
    LIMIT 1
  `;

  if (!jobAccessRows[0]) {
    throw new JobNotFoundForUserError();
  }
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: unknown }).code === '42P01';
}

async function listShopJobsRaw(shopId: string): Promise<ShopJobsList> {
  const jobs = await prisma.$queryRaw<JobRow[]>`
    SELECT
      j."id",
      j."name",
      COALESCE(NULLIF(BTRIM(customerUser."name"), ''), customerUser."email") AS "customer",
      j."category",
      j."status",
      j."priority",
      j."dueDate",
      COALESCE(NULLIF(BTRIM(assigneeUser."name"), ''), assigneeUser."email", 'Unassigned') AS "assignee",
      j."createdAt"
    FROM "Job" j
    INNER JOIN "Membership" customerMembership ON customerMembership."id" = j."customerMembershipId"
    INNER JOIN "User" customerUser ON customerUser."id" = customerMembership."userId"
    LEFT JOIN "Membership" assigneeMembership ON assigneeMembership."id" = j."assigneeMembershipId"
    LEFT JOIN "User" assigneeUser ON assigneeUser."id" = assigneeMembership."userId"
    WHERE j."shopId" = ${shopId}
    ORDER BY j."dueDate" ASC, j."createdAt" ASC
  `;

  if (jobs.length === 0) {
    return { jobs: [] };
  }

  const parts = await prisma.$queryRaw<JobPartRow[]>`
    SELECT
      jp."id",
      jp."jobId",
      jp."code",
      jp."name",
      jp."process",
      jp."material",
      jp."machine",
      jp."quantity",
      jp."status",
      jp."createdAt"
    FROM "JobPart" jp
    INNER JOIN "Job" j ON j."id" = jp."jobId"
    WHERE j."shopId" = ${shopId}
    ORDER BY jp."createdAt" ASC
  `;

  const partsByJobId = new Map<string, JobPartSummary[]>();

  for (const part of parts) {
    const currentParts = partsByJobId.get(part.jobId) ?? [];
    currentParts.push({
      id: part.id,
      code: part.code,
      name: part.name,
      process: part.process,
      material: part.material,
      machine: part.machine,
      quantity: part.quantity,
      status: part.status,
    });
    partsByJobId.set(part.jobId, currentParts);
  }

  return {
    jobs: jobs.map((job) => ({
      id: job.id,
      name: job.name,
      customer: job.customer,
      category: job.category,
      status: job.status,
      priority: job.priority,
      dueDate: toIsoDate(job.dueDate),
      assignee: job.assignee,
      parts: partsByJobId.get(job.id) ?? [],
    })),
  };
}

export async function listShopJobsForUser(userId: string, shopId: string): Promise<ShopJobsList> {
  try {
    await ensureShopMembership(userId, shopId);
    return await listShopJobsRaw(shopId);
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new JobsSchemaNotReadyError();
    }

    throw error;
  }
}

export type CreateJobInput = z.infer<typeof createJobInputSchema>;
export type CreateJobUploadTargetsInput = z.infer<typeof createJobUploadTargetsInputSchema>;

async function getRequesterMembership(userId: string, shopId: string): Promise<ShopMembershipForJobRow> {
  const requesterRows = await prisma.$queryRaw<ShopMembershipForJobRow[]>`
    SELECT
      m."id" AS "membershipId",
      COALESCE(NULLIF(BTRIM(u."name"), ''), u."email") AS "displayName"
    FROM "Membership" m
    INNER JOIN "User" u ON u."id" = m."userId"
    WHERE m."userId" = ${userId}
      AND m."shopId" = ${shopId}
    LIMIT 1
  `;

  const requester = requesterRows[0];
  if (!requester) {
    throw new ShopNotFoundForUserError();
  }

  return requester;
}

export async function updateJobStatusForUser(
  userId: string,
  shopId: string,
  jobId: string,
  status: JobStatus,
): Promise<UpdateJobStatusResult> {
  try {
    await ensureJobAccess(userId, shopId, jobId);

    const now = new Date();
    const updatedRowCount = await prisma.$executeRaw`
      UPDATE "Job"
      SET
        "status" = ${status},
        "updatedAt" = ${now}
      WHERE "id" = ${jobId}
        AND "shopId" = ${shopId}
    `;

    if (updatedRowCount === 0) {
      throw new JobNotFoundForUserError();
    }

    return {
      id: jobId,
      status,
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new JobsSchemaNotReadyError();
    }

    throw error;
  }
}

export async function createJobUploadTargetsForUser(
  userId: string,
  input: CreateJobUploadTargetsInput,
): Promise<CreateJobUploadTargetsResult> {
  try {
    await ensureShopMembership(userId, input.shopId);

    const storageConfig = getUploadStorageConfig();
    const s3Client = getUploadS3Client(storageConfig);

    const uploads = await Promise.all(
      input.files.map(async (file): Promise<JobUploadTarget> => {
        const objectKey = buildUploadObjectKey(
          storageConfig.projectName,
          input.shopId,
          file.name,
        );

        const conditions: PresignedPostCondition[] = [
          ['content-length-range', 1, MAX_UPLOAD_FILE_SIZE_BYTES],
        ];
        const fields: Record<string, string> = {};

        if (file.contentType) {
          fields['Content-Type'] = file.contentType;
          conditions.push(['eq', '$Content-Type', file.contentType]);
        }

        const presignedPost = await createPresignedPost(s3Client, {
          Bucket: storageConfig.bucket,
          Key: objectKey,
          Conditions: conditions,
          Fields: fields,
          Expires: 60 * 15,
        });

        return {
          fileName: file.name,
          objectKey,
          uploadUrl: presignedPost.url,
          uploadFields: presignedPost.fields,
        };
      }),
    );

    return {
      uploads,
      maxFileSizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES,
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new JobsSchemaNotReadyError();
    }

    throw error;
  }
}

export async function createJobForUser(userId: string, input: CreateJobInput): Promise<ShopJobSummary> {
  try {
    const requesterMembership = await getRequesterMembership(userId, input.shopId);

    const jobId = randomUUID();
    const now = new Date();
    const dueDate = parseDateOnlyToUtc(input.dueDate);

    await prisma.$executeRaw`
      INSERT INTO "Job" (
        "id",
        "shopId",
        "name",
        "customerMembershipId",
        "category",
        "status",
        "priority",
        "dueDate",
        "assigneeMembershipId",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${jobId},
        ${input.shopId},
        ${input.name},
        ${requesterMembership.membershipId},
        ${input.category},
        ${input.status},
        ${input.priority},
        ${dueDate},
        ${null},
        ${now},
        ${now}
      )
    `;

    return {
      id: jobId,
      name: input.name,
      customer: requesterMembership.displayName,
      category: input.category,
      status: input.status,
      priority: input.priority,
      dueDate: toIsoDate(dueDate),
      assignee: 'Unassigned',
      parts: [],
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new JobsSchemaNotReadyError();
    }

    throw error;
  }
}
