-- AlterTable
ALTER TABLE "users" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'approved';

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");
