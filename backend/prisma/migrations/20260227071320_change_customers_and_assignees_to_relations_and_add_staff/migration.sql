/*
  Warnings:

  - You are about to drop the column `assignee` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `customer` on the `Job` table. All the data in the column will be lost.
  - Added the required column `assigneeMembershipId` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerMembershipId` to the `Job` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "MembershipRole" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "assignee",
DROP COLUMN "customer",
ADD COLUMN     "assigneeMembershipId" TEXT NOT NULL,
ADD COLUMN     "customerMembershipId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Job_customerMembershipId_idx" ON "Job"("customerMembershipId");

-- CreateIndex
CREATE INDEX "Job_assigneeMembershipId_idx" ON "Job"("assigneeMembershipId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_customerMembershipId_fkey" FOREIGN KEY ("customerMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_assigneeMembershipId_fkey" FOREIGN KEY ("assigneeMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
