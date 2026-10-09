ALTER TABLE "User" ADD COLUMN "requestedParkId" TEXT;
CREATE INDEX "User_requestedParkId_idx" ON "User"("requestedParkId");
ALTER TABLE "User" ADD CONSTRAINT "User_requestedParkId_fkey" FOREIGN KEY ("requestedParkId") REFERENCES "Park"("id") ON DELETE SET NULL ON UPDATE CASCADE;
