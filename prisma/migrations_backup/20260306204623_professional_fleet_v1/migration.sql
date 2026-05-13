-- CreateEnum
CREATE TYPE "AracDurumu" AS ENUM ('AKTIF', 'SERVISTE', 'YEDEK', 'ARIZALI', 'SATILDI');

-- CreateEnum
CREATE TYPE "MasrafKategorisi" AS ENUM ('YAKIT', 'HGS_YUKLEME', 'YIKAMA', 'AKSESUAR', 'DIGER');

-- CreateEnum
CREATE TYPE "ArizaDurumu" AS ENUM ('ACIK', 'TAMIRDE', 'COZULDU', 'PARCA_BEKLIYOR');

-- CreateEnum
CREATE TYPE "DokumanTuru" AS ENUM ('RUHSAT', 'SIGORTA', 'KASKO', 'SERVIS_FATURA', 'DIGER');

-- CreateTable
CREATE TABLE "Arac" (
    "id" TEXT NOT NULL,
    "plaka" TEXT NOT NULL,
    "marka" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "yil" INTEGER NOT NULL,
    "bulunduguIl" TEXT NOT NULL,
    "guncelKm" INTEGER NOT NULL DEFAULT 0,
    "hgsNo" TEXT,
    "ruhsatSeriNo" TEXT,
    "durum" "AracDurumu" NOT NULL DEFAULT 'AKTIF',
    "soforId" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Arac_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sofor" (
    "id" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "telefon" TEXT,
    "tcNo" TEXT,

    CONSTRAINT "Sofor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoforZimmet" (
    "id" TEXT NOT NULL,
    "aracId" TEXT NOT NULL,
    "soforId" TEXT NOT NULL,
    "baslangic" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bitis" TIMESTAMP(3),
    "baslangicKm" INTEGER NOT NULL,
    "bitisKm" INTEGER,
    "notlar" TEXT,

    CONSTRAINT "SoforZimmet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafikSigortasi" (
    "id" TEXT NOT NULL,
    "sirket" TEXT,
    "policeNo" TEXT,
    "baslangicTarihi" TIMESTAMP(3) NOT NULL,
    "bitisTarihi" TIMESTAMP(3) NOT NULL,
    "tutar" DOUBLE PRECISION,
    "aktifMi" BOOLEAN NOT NULL DEFAULT true,
    "aracId" TEXT NOT NULL,

    CONSTRAINT "TrafikSigortasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kasko" (
    "id" TEXT NOT NULL,
    "sirket" TEXT,
    "policeNo" TEXT,
    "baslangicTarihi" TIMESTAMP(3) NOT NULL,
    "bitisTarihi" TIMESTAMP(3) NOT NULL,
    "tutar" DOUBLE PRECISION,
    "aktifMi" BOOLEAN NOT NULL DEFAULT true,
    "aracId" TEXT NOT NULL,

    CONSTRAINT "Kasko_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Muayene" (
    "id" TEXT NOT NULL,
    "muayeneTarihi" TIMESTAMP(3) NOT NULL,
    "gecerlilikTarihi" TIMESTAMP(3) NOT NULL,
    "istasyon" TEXT,
    "aktifMi" BOOLEAN NOT NULL DEFAULT true,
    "aracId" TEXT NOT NULL,

    CONSTRAINT "Muayene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bakim" (
    "id" TEXT NOT NULL,
    "bakimTarihi" TIMESTAMP(3) NOT NULL,
    "yapilanKm" INTEGER NOT NULL,
    "sonrakiBakimKm" INTEGER,
    "servisAdi" TEXT,
    "yapilanIslemler" TEXT,
    "tutar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aracId" TEXT NOT NULL,

    CONSTRAINT "Bakim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ceza" (
    "id" TEXT NOT NULL,
    "cezaTarihi" TIMESTAMP(3) NOT NULL,
    "tutar" DOUBLE PRECISION NOT NULL,
    "aciklama" TEXT,
    "odendiMi" BOOLEAN NOT NULL DEFAULT false,
    "aracId" TEXT NOT NULL,

    CONSTRAINT "Ceza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Masraf" (
    "id" TEXT NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tur" "MasrafKategorisi" NOT NULL,
    "tutar" DOUBLE PRECISION NOT NULL,
    "aracId" TEXT NOT NULL,

    CONSTRAINT "Masraf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Yakit" (
    "id" TEXT NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "litre" DOUBLE PRECISION NOT NULL,
    "tutar" DOUBLE PRECISION NOT NULL,
    "km" INTEGER NOT NULL,
    "istasyon" TEXT,
    "aracId" TEXT NOT NULL,

    CONSTRAINT "Yakit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ariza" (
    "id" TEXT NOT NULL,
    "aciklama" TEXT NOT NULL,
    "arizaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durum" "ArizaDurumu" NOT NULL DEFAULT 'ACIK',
    "servis" TEXT,
    "tahminiTutar" DOUBLE PRECISION,
    "aracId" TEXT NOT NULL,

    CONSTRAINT "Ariza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dokuman" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "dosyaUrl" TEXT NOT NULL,
    "tur" "DokumanTuru" NOT NULL,
    "yuklemeTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aracId" TEXT NOT NULL,

    CONSTRAINT "Dokuman_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Arac_plaka_key" ON "Arac"("plaka");

-- CreateIndex
CREATE UNIQUE INDEX "Arac_soforId_key" ON "Arac"("soforId");

-- CreateIndex
CREATE INDEX "Arac_plaka_idx" ON "Arac"("plaka");

-- CreateIndex
CREATE INDEX "Arac_durum_idx" ON "Arac"("durum");

-- CreateIndex
CREATE UNIQUE INDEX "Sofor_tcNo_key" ON "Sofor"("tcNo");

-- CreateIndex
CREATE INDEX "SoforZimmet_aracId_idx" ON "SoforZimmet"("aracId");

-- CreateIndex
CREATE INDEX "SoforZimmet_soforId_idx" ON "SoforZimmet"("soforId");

-- CreateIndex
CREATE INDEX "TrafikSigortasi_aracId_idx" ON "TrafikSigortasi"("aracId");

-- CreateIndex
CREATE INDEX "Kasko_aracId_idx" ON "Kasko"("aracId");

-- CreateIndex
CREATE INDEX "Muayene_aracId_idx" ON "Muayene"("aracId");

-- CreateIndex
CREATE INDEX "Bakim_aracId_idx" ON "Bakim"("aracId");

-- CreateIndex
CREATE INDEX "Ceza_aracId_idx" ON "Ceza"("aracId");

-- CreateIndex
CREATE INDEX "Masraf_aracId_idx" ON "Masraf"("aracId");

-- CreateIndex
CREATE INDEX "Yakit_aracId_idx" ON "Yakit"("aracId");

-- CreateIndex
CREATE INDEX "Yakit_tarih_idx" ON "Yakit"("tarih");

-- CreateIndex
CREATE INDEX "Ariza_aracId_idx" ON "Ariza"("aracId");

-- CreateIndex
CREATE INDEX "Dokuman_aracId_idx" ON "Dokuman"("aracId");

-- AddForeignKey
ALTER TABLE "Arac" ADD CONSTRAINT "Arac_soforId_fkey" FOREIGN KEY ("soforId") REFERENCES "Sofor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoforZimmet" ADD CONSTRAINT "SoforZimmet_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoforZimmet" ADD CONSTRAINT "SoforZimmet_soforId_fkey" FOREIGN KEY ("soforId") REFERENCES "Sofor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafikSigortasi" ADD CONSTRAINT "TrafikSigortasi_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kasko" ADD CONSTRAINT "Kasko_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Muayene" ADD CONSTRAINT "Muayene_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bakim" ADD CONSTRAINT "Bakim_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ceza" ADD CONSTRAINT "Ceza_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Masraf" ADD CONSTRAINT "Masraf_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Yakit" ADD CONSTRAINT "Yakit_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ariza" ADD CONSTRAINT "Ariza_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dokuman" ADD CONSTRAINT "Dokuman_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
