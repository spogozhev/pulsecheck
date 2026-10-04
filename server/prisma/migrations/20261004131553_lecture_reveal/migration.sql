-- AlterTable
ALTER TABLE "lectures" ADD COLUMN     "results_revealed_at" TIMESTAMP(3),
ADD COLUMN     "slide_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
