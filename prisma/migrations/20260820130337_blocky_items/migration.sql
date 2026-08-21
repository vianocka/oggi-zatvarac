/*
  Warnings:

  - You are about to drop the column `blocky` on the `DailyClosing` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DailyClosing" DROP COLUMN "blocky";

-- CreateTable
CREATE TABLE "BlockyItem" (
    "id" TEXT NOT NULL,
    "nazov" TEXT NOT NULL,
    "suma" DECIMAL(65,30) NOT NULL,
    "position" INTEGER NOT NULL,
    "dailyClosingId" TEXT NOT NULL,

    CONSTRAINT "BlockyItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockyItem_dailyClosingId_idx" ON "BlockyItem"("dailyClosingId");

-- AddForeignKey
ALTER TABLE "BlockyItem" ADD CONSTRAINT "BlockyItem_dailyClosingId_fkey" FOREIGN KEY ("dailyClosingId") REFERENCES "DailyClosing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
