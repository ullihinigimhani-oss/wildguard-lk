-- Existing accounts stay APPROVED, including the currently working PARK_MANAGER.
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "User"
  ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "profileImageUrl" TEXT,
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT;
CREATE INDEX "User_approvalStatus_role_createdAt_idx" ON "User"("approvalStatus", "role", "createdAt");
