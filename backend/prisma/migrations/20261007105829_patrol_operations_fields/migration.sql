-- CreateEnum
CREATE TYPE "PatrolType" AS ENUM ('ROUTINE', 'ANTI_POACHING', 'WILDLIFE_MONITORING', 'CONFLICT_RESPONSE', 'SPECIAL');

-- CreateEnum
CREATE TYPE "PatrolPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Patrol" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "patrolType" "PatrolType" NOT NULL DEFAULT 'ROUTINE',
ADD COLUMN     "priority" "PatrolPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "startLocation" TEXT;
