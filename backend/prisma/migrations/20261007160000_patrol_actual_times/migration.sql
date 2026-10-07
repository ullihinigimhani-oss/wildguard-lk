-- Additive only: preserve all records and original schedule fields.
ALTER TABLE "Patrol"
ADD COLUMN "actualStartTime" TIMESTAMP(3),
ADD COLUMN "actualEndTime" TIMESTAMP(3);
