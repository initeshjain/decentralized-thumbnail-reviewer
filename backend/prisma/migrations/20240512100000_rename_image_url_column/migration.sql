/*
  Warnings:

  - You are about to drop the column `image_urls` on the `Option` table. All the data in the column will be lost.
  - Added the required column `image_url` to the `Option` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Option" DROP COLUMN "image_urls",
ADD COLUMN     "image_url" TEXT NOT NULL;
