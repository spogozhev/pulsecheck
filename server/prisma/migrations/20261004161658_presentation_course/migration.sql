-- AlterTable
ALTER TABLE "presentations" ADD COLUMN     "course" TEXT;

-- CreateIndex
CREATE INDEX "presentations_teacher_id_course_idx" ON "presentations"("teacher_id", "course");
