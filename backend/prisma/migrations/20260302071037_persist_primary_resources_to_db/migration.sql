-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "primaryMaterial" TEXT NOT NULL DEFAULT 'Other',
ADD COLUMN     "primaryProcess" TEXT NOT NULL DEFAULT 'Other',
ADD COLUMN     "primaryResource" TEXT NOT NULL DEFAULT 'Other';
