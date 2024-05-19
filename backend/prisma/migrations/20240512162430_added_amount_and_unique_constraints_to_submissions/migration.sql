/*
  Warnings:

  - A unique constraint covering the columns `[worker_id,task_id]` on the table `Submission` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `amount` to the `Submission` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "amount" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Submission_worker_id_task_id_key" ON "Submission"("worker_id", "task_id");
