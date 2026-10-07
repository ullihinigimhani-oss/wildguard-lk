-- Additive only: legacy rows retain null type, order and label.
CREATE TYPE "PatrolWaypointType" AS ENUM ('START', 'CHECKPOINT', 'HIGH_RISK', 'OBSERVATION', 'END');
ALTER TABLE "PatrolWaypoint" ADD COLUMN "type" "PatrolWaypointType", ADD COLUMN "order" INTEGER, ADD COLUMN "label" TEXT;
CREATE UNIQUE INDEX "PatrolWaypoint_patrolId_order_key" ON "PatrolWaypoint"("patrolId", "order");
