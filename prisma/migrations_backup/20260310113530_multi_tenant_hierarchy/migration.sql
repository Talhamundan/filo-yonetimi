/*
  Warnings:

  - You are about to drop the column `soforId` on the `Arac` table. All the data in the column will be lost.
  - The `bulunduguIl` column on the `Arac` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Sofor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SoforZimmet` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[kullaniciId]` on the table `Arac` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'YONETICI', 'MUDUR', 'MUHASEBECI', 'SOFOR');

-- CreateEnum
CREATE TYPE "BakimTuru" AS ENUM ('PERIYODIK', 'ARIZA', 'KAPORTA');

-- CreateEnum
CREATE TYPE "iller" AS ENUM ('İSTANBUL', 'BURSA', 'ŞANLIURFA', 'ANKARA', 'DİĞER');

-- DropForeignKey
ALTER TABLE "Arac" DROP CONSTRAINT "Arac_soforId_fkey";

-- DropForeignKey
ALTER TABLE "SoforZimmet" DROP CONSTRAINT "SoforZimmet_aracId_fkey";

-- DropForeignKey
ALTER TABLE "SoforZimmet" DROP CONSTRAINT "SoforZimmet_soforId_fkey";

-- DropIndex
DROP INDEX "Arac_soforId_key";

-- AlterTable
ALTER TABLE "Arac" DROP COLUMN "soforId",
ADD COLUMN     "kullaniciId" TEXT,
ADD COLUMN     "sirketId" TEXT,
DROP COLUMN "bulunduguIl",
ADD COLUMN     "bulunduguIl" "iller" NOT NULL DEFAULT 'BURSA';

-- AlterTable
ALTER TABLE "Bakim" ADD COLUMN     "tur" "BakimTuru" NOT NULL DEFAULT 'PERIYODIK';

-- AlterTable
ALTER TABLE "Ceza" ADD COLUMN     "kullaniciId" TEXT;

-- DropTable
DROP TABLE "Sofor";

-- DropTable
DROP TABLE "SoforZimmet";

-- CreateTable
CREATE TABLE "Sirket" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "bulunduguIl" "iller" NOT NULL DEFAULT 'BURSA',
    "vergiNo" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sirket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kullanici" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "soyad" TEXT NOT NULL,
    "telefon" TEXT,
    "tcNo" TEXT,
    "sehir" "iller",
    "eposta" TEXT,
    "sifre" TEXT,
    "rol" "Rol" NOT NULL DEFAULT 'SOFOR',
    "sirketId" TEXT,

    CONSTRAINT "Kullanici_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KullaniciZimmet" (
    "id" TEXT NOT NULL,
    "aracId" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "baslangic" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bitis" TIMESTAMP(3),
    "baslangicKm" INTEGER NOT NULL,
    "bitisKm" INTEGER,
    "notlar" TEXT,

    CONSTRAINT "KullaniciZimmet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kullanici_tcNo_key" ON "Kullanici"("tcNo");

-- CreateIndex
CREATE UNIQUE INDEX "Kullanici_eposta_key" ON "Kullanici"("eposta");

-- CreateIndex
CREATE INDEX "Kullanici_sirketId_idx" ON "Kullanici"("sirketId");

-- CreateIndex
CREATE INDEX "KullaniciZimmet_aracId_idx" ON "KullaniciZimmet"("aracId");

-- CreateIndex
CREATE INDEX "KullaniciZimmet_kullaniciId_idx" ON "KullaniciZimmet"("kullaniciId");

-- CreateIndex
CREATE UNIQUE INDEX "Arac_kullaniciId_key" ON "Arac"("kullaniciId");

-- CreateIndex
CREATE INDEX "Arac_sirketId_idx" ON "Arac"("sirketId");

-- CreateIndex
CREATE INDEX "Ceza_kullaniciId_idx" ON "Ceza"("kullaniciId");

-- AddForeignKey
ALTER TABLE "Arac" ADD CONSTRAINT "Arac_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arac" ADD CONSTRAINT "Arac_sirketId_fkey" FOREIGN KEY ("sirketId") REFERENCES "Sirket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kullanici" ADD CONSTRAINT "Kullanici_sirketId_fkey" FOREIGN KEY ("sirketId") REFERENCES "Sirket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KullaniciZimmet" ADD CONSTRAINT "KullaniciZimmet_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KullaniciZimmet" ADD CONSTRAINT "KullaniciZimmet_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ceza" ADD CONSTRAINT "Ceza_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;
