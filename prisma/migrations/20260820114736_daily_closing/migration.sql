/*
  Warnings:

  - You are about to drop the `ContactMessage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "ContactMessage";

-- CreateTable
CREATE TABLE "DailyClosing" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalSum" DECIMAL(65,30) NOT NULL,
    "terminal1" DECIMAL(65,30) NOT NULL,
    "terminal2" DECIMAL(65,30) NOT NULL,
    "choiceQr" DECIMAL(65,30) NOT NULL,
    "wolt" DECIMAL(65,30) NOT NULL,
    "choiceTips" DECIMAL(65,30) NOT NULL,
    "couvert" DECIMAL(65,30)[],
    "blocky" DECIMAL(65,30)[],
    "hotovostDoObalky" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyClosing_date_key" ON "DailyClosing"("date");
