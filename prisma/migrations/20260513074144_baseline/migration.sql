-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'YETKILI', 'PERSONEL', 'TEKNIK');

-- CreateEnum
CREATE TYPE "AracDurumu" AS ENUM ('BOSTA', 'AKTIF', 'SERVISTE', 'YEDEK', 'ARIZALI');

-- CreateEnum
CREATE TYPE "AracKategori" AS ENUM ('BINEK', 'SANTIYE');

-- CreateEnum
CREATE TYPE "AracAltKategori" AS ENUM ('OTOMOBIL', 'MINIBUS', 'KAMYONET', 'KAMYON', 'CEKICI', 'ROMORK', 'TRAKTOR', 'IS_MAKINESI');

-- CreateEnum
CREATE TYPE "DisFirmaTuru" AS ENUM ('TASERON', 'KIRALIK');

-- CreateEnum
CREATE TYPE "MasrafKategorisi" AS ENUM ('YAKIT', 'HGS_YUKLEME', 'YIKAMA', 'AKSESUAR', 'DIGER', 'BAKIM_ONARIM', 'LASTIK', 'TEMIZLIK', 'OTOPARK', 'KOPRU_OBO');

-- CreateEnum
CREATE TYPE "DokumanTuru" AS ENUM ('RUHSAT', 'SIGORTA', 'KASKO', 'SERVIS_FATURA', 'DIGER');

-- CreateEnum
CREATE TYPE "BakimTuru" AS ENUM ('PERIYODIK', 'ARIZA', 'KAPORTA');

-- CreateEnum
CREATE TYPE "ServisKategori" AS ENUM ('PERIYODIK_BAKIM', 'ARIZA');

-- CreateEnum
CREATE TYPE "ArizaKaydiDurumu" AS ENUM ('ACIK', 'SERVISTE', 'TAMAMLANDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "ArizaOncelik" AS ENUM ('DUSUK', 'ORTA', 'YUKSEK', 'KRITIK');

-- CreateEnum
CREATE TYPE "OnayDurumu" AS ENUM ('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI');

-- CreateEnum
CREATE TYPE "OdemeYontemi" AS ENUM ('NAKIT', 'TASIT_TANIMA');

-- CreateEnum
CREATE TYPE "YakitTankHareketTip" AS ENUM ('ALIM', 'CIKIS', 'TRANSFER');

-- CreateEnum
CREATE TYPE "ActivityActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'ARCHIVE', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'ROLE_CHANGE', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "ActivityEntityType" AS ENUM ('ARAC', 'MASRAF', 'BAKIM', 'DOKUMAN', 'CEZA', 'KULLANICI', 'OTURUM', 'DIGER', 'TEDARKICI');

-- CreateTable
CREATE TABLE "Sirket" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "vergiNo" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bulunduguIl" TEXT NOT NULL DEFAULT 'BURSA',
    "santiyeler" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Sirket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisFirma" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "tur" "DisFirmaTuru" NOT NULL,
    "sehir" TEXT NOT NULL DEFAULT 'BURSA',
    "vergiNo" TEXT,
    "yetkiliKisi" TEXT,
    "telefon" TEXT,
    "calistigiKurum" TEXT,

    CONSTRAINT "DisFirma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arac" (
    "id" TEXT NOT NULL,
    "plaka" TEXT,
    "marka" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "yil" INTEGER NOT NULL,
    "guncelKm" INTEGER NOT NULL DEFAULT 0,
    "hgsNo" TEXT,
    "ruhsatSeriNo" TEXT,
    "durum" "AracDurumu" NOT NULL DEFAULT 'AKTIF',
    "kullaniciId" TEXT,
    "sirketId" TEXT,
    "disFirmaId" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kategori" "AracKategori" NOT NULL DEFAULT 'BINEK',
    "altKategori" "AracAltKategori" NOT NULL DEFAULT 'OTOMOBIL',
    "saseNo" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "aciklama" TEXT,
    "bedel" DOUBLE PRECISION,
    "calistigiKurum" TEXT,
    "motorNo" TEXT,
    "bulunduguIl" TEXT NOT NULL DEFAULT 'BURSA',

    CONSTRAINT "Arac_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Personel" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "soyad" TEXT NOT NULL,
    "telefon" TEXT,
    "tcNo" TEXT,
    "calistigiKurum" TEXT,
    "santiye" TEXT,
    "eposta" TEXT,
    "sifre" TEXT,
    "rol" "Rol" NOT NULL DEFAULT 'PERSONEL',
    "sirketId" TEXT,
    "disFirmaId" TEXT,
    "onayDurumu" "OnayDurumu" NOT NULL DEFAULT 'BEKLIYOR',
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Personel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KullaniciYetkiliSirket" (
    "id" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "sirketId" TEXT NOT NULL,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KullaniciYetkiliSirket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonelZimmet" (
    "id" TEXT NOT NULL,
    "aracId" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "baslangic" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bitis" TIMESTAMP(3),
    "baslangicKm" INTEGER NOT NULL,
    "bitisKm" INTEGER,
    "notlar" TEXT,
    "saseNo" TEXT,

    CONSTRAINT "PersonelZimmet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hesap" (
    "id" TEXT NOT NULL,
    "personelId" TEXT NOT NULL,
    "kullaniciAdi" TEXT NOT NULL,
    "sifreHash" TEXT NOT NULL,
    "aktifMi" BOOLEAN NOT NULL DEFAULT true,
    "sonGirisTarihi" TIMESTAMP(3),
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hesap_pkey" PRIMARY KEY ("id")
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
    "sirketId" TEXT,
    "acente" TEXT,
    "saseNo" TEXT,

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
    "sirketId" TEXT,
    "acente" TEXT,
    "saseNo" TEXT,

    CONSTRAINT "Kasko_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Muayene" (
    "id" TEXT NOT NULL,
    "muayeneTarihi" TIMESTAMP(3) NOT NULL,
    "gecerlilikTarihi" TIMESTAMP(3) NOT NULL,
    "aktifMi" BOOLEAN NOT NULL DEFAULT true,
    "aracId" TEXT NOT NULL,
    "sirketId" TEXT,
    "km" INTEGER,
    "tutar" DOUBLE PRECISION,
    "gectiMi" BOOLEAN NOT NULL DEFAULT true,
    "saseNo" TEXT,
    "odendiMi" BOOLEAN NOT NULL DEFAULT false,

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
    "tur" "BakimTuru" NOT NULL DEFAULT 'PERIYODIK',
    "aracId" TEXT,
    "sirketId" TEXT,
    "kategori" "ServisKategori" NOT NULL DEFAULT 'PERIYODIK_BAKIM',
    "saseNo" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "arizaSikayet" TEXT,
    "degisenParca" TEXT,
    "islemYapanFirma" TEXT,
    "plaka" TEXT,
    "odendiMi" BOOLEAN NOT NULL DEFAULT false,
    "soforId" TEXT,

    CONSTRAINT "Bakim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArizaKaydi" (
    "id" TEXT NOT NULL,
    "aracId" TEXT NOT NULL,
    "kullaniciId" TEXT,
    "sirketId" TEXT,
    "bakimId" TEXT,
    "aciklama" TEXT NOT NULL,
    "kazaTarihi" TIMESTAMP(3),
    "kazaYeri" TEXT,
    "kazaTuru" TEXT,
    "sigortaDosyaNo" TEXT,
    "eksperNotu" TEXT,
    "kusurOrani" INTEGER,
    "oncelik" "ArizaOncelik" NOT NULL DEFAULT 'ORTA',
    "durum" "ArizaKaydiDurumu" NOT NULL DEFAULT 'ACIK',
    "km" INTEGER,
    "servisAdi" TEXT,
    "yapilanIslemler" TEXT,
    "tutar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bildirimTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serviseSevkTarihi" TIMESTAMP(3),
    "kapanisTarihi" TIMESTAMP(3),
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArizaKaydi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ceza" (
    "id" TEXT NOT NULL,
    "cezaTarihi" TIMESTAMP(3) NOT NULL,
    "tutar" DOUBLE PRECISION NOT NULL,
    "aciklama" TEXT,
    "odendiMi" BOOLEAN NOT NULL DEFAULT false,
    "aracId" TEXT NOT NULL,
    "kullaniciId" TEXT,
    "sirketId" TEXT,
    "km" INTEGER,
    "sonOdemeTarihi" TIMESTAMP(3),
    "plaka" TEXT,
    "cezaMaddesi" TEXT NOT NULL DEFAULT 'Belirtilmedi',
    "saseNo" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Ceza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Masraf" (
    "id" TEXT NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tur" "MasrafKategorisi" NOT NULL,
    "tutar" DOUBLE PRECISION NOT NULL,
    "aracId" TEXT NOT NULL,
    "aciklama" TEXT,
    "sirketId" TEXT,
    "saseNo" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Masraf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Yakit" (
    "id" TEXT NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "litre" DOUBLE PRECISION NOT NULL,
    "tutar" DOUBLE PRECISION NOT NULL,
    "km" INTEGER,
    "istasyon" TEXT,
    "aracId" TEXT NOT NULL,
    "sirketId" TEXT,
    "odemeYontemi" "OdemeYontemi" NOT NULL DEFAULT 'NAKIT',
    "saseNo" TEXT,
    "odendiMi" BOOLEAN NOT NULL DEFAULT false,
    "endeks" INTEGER,
    "soforId" TEXT,

    CONSTRAINT "Yakit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YakitTank" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "kapasiteLitre" DOUBLE PRECISION NOT NULL,
    "mevcutLitre" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "birimMaliyet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aktifMi" BOOLEAN NOT NULL DEFAULT true,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sirketId" TEXT,

    CONSTRAINT "YakitTank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YakitTankHareket" (
    "id" TEXT NOT NULL,
    "tip" "YakitTankHareketTip" NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "litre" DOUBLE PRECISION NOT NULL,
    "birimMaliyet" DOUBLE PRECISION NOT NULL,
    "toplamTutar" DOUBLE PRECISION NOT NULL,
    "tankId" TEXT NOT NULL,
    "hedefTankId" TEXT,
    "aracId" TEXT,
    "yakitId" TEXT,
    "istasyon" TEXT,
    "km" INTEGER,
    "aciklama" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endeks" INTEGER,
    "soforId" TEXT,

    CONSTRAINT "YakitTankHareket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HgsYukleme" (
    "id" TEXT NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etiketNo" TEXT,
    "tutar" DOUBLE PRECISION NOT NULL,
    "aracId" TEXT NOT NULL,
    "sirketId" TEXT,
    "km" INTEGER,
    "saseNo" TEXT,

    CONSTRAINT "HgsYukleme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actionType" "ActivityActionType" NOT NULL,
    "entityType" "ActivityEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dokuman" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "dosyaUrl" TEXT NOT NULL,
    "tur" "DokumanTuru" NOT NULL,
    "yuklemeTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aracId" TEXT NOT NULL,
    "sirketId" TEXT,
    "saseNo" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Dokuman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StokKalem" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "kategori" TEXT,
    "miktar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "birim" TEXT NOT NULL DEFAULT 'ADET',
    "konum" TEXT,
    "kritikSeviye" DOUBLE PRECISION,
    "aciklama" TEXT,
    "sirketId" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StokKalem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigortaTeklif" (
    "id" TEXT NOT NULL,
    "aracId" TEXT NOT NULL,
    "tur" TEXT NOT NULL,
    "acente" TEXT,
    "sigortaSirketi" TEXT,
    "policeNo" TEXT,
    "baslangicTarihi" TIMESTAMP(3) NOT NULL,
    "bitisTarihi" TIMESTAMP(3) NOT NULL,
    "teklifTutar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durum" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "notlar" TEXT,
    "sirketId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "olusturulanKayitId" TEXT,
    "olusturulanKayitTur" TEXT,
    "olusturulmaTarihi" TIMESTAMP(3),

    CONSTRAINT "SigortaTeklif_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisFirma_tur_idx" ON "DisFirma"("tur");

-- CreateIndex
CREATE INDEX "DisFirma_ad_idx" ON "DisFirma"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "Arac_plaka_key" ON "Arac"("plaka");

-- CreateIndex
CREATE UNIQUE INDEX "Arac_kullaniciId_key" ON "Arac"("kullaniciId");

-- CreateIndex
CREATE INDEX "Arac_plaka_idx" ON "Arac"("plaka");

-- CreateIndex
CREATE INDEX "Arac_durum_idx" ON "Arac"("durum");

-- CreateIndex
CREATE INDEX "Arac_sirketId_idx" ON "Arac"("sirketId");

-- CreateIndex
CREATE INDEX "Arac_disFirmaId_idx" ON "Arac"("disFirmaId");

-- CreateIndex
CREATE INDEX "Arac_deletedAt_idx" ON "Arac"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Personel_tcNo_key" ON "Personel"("tcNo");

-- CreateIndex
CREATE UNIQUE INDEX "Personel_eposta_key" ON "Personel"("eposta");

-- CreateIndex
CREATE INDEX "Personel_sirketId_idx" ON "Personel"("sirketId");

-- CreateIndex
CREATE INDEX "Personel_disFirmaId_idx" ON "Personel"("disFirmaId");

-- CreateIndex
CREATE INDEX "Personel_deletedAt_idx" ON "Personel"("deletedAt");

-- CreateIndex
CREATE INDEX "KullaniciYetkiliSirket_kullaniciId_idx" ON "KullaniciYetkiliSirket"("kullaniciId");

-- CreateIndex
CREATE INDEX "KullaniciYetkiliSirket_sirketId_idx" ON "KullaniciYetkiliSirket"("sirketId");

-- CreateIndex
CREATE UNIQUE INDEX "KullaniciYetkiliSirket_kullaniciId_sirketId_key" ON "KullaniciYetkiliSirket"("kullaniciId", "sirketId");

-- CreateIndex
CREATE INDEX "PersonelZimmet_aracId_idx" ON "PersonelZimmet"("aracId");

-- CreateIndex
CREATE INDEX "PersonelZimmet_kullaniciId_idx" ON "PersonelZimmet"("kullaniciId");

-- CreateIndex
CREATE UNIQUE INDEX "Hesap_personelId_key" ON "Hesap"("personelId");

-- CreateIndex
CREATE UNIQUE INDEX "Hesap_kullaniciAdi_key" ON "Hesap"("kullaniciAdi");

-- CreateIndex
CREATE INDEX "Hesap_aktifMi_idx" ON "Hesap"("aktifMi");

-- CreateIndex
CREATE INDEX "TrafikSigortasi_aracId_idx" ON "TrafikSigortasi"("aracId");

-- CreateIndex
CREATE INDEX "TrafikSigortasi_sirketId_idx" ON "TrafikSigortasi"("sirketId");

-- CreateIndex
CREATE INDEX "Kasko_aracId_idx" ON "Kasko"("aracId");

-- CreateIndex
CREATE INDEX "Kasko_sirketId_idx" ON "Kasko"("sirketId");

-- CreateIndex
CREATE INDEX "Muayene_aracId_idx" ON "Muayene"("aracId");

-- CreateIndex
CREATE INDEX "Muayene_sirketId_idx" ON "Muayene"("sirketId");

-- CreateIndex
CREATE INDEX "Bakim_plaka_idx" ON "Bakim"("plaka");

-- CreateIndex
CREATE INDEX "Bakim_aracId_idx" ON "Bakim"("aracId");

-- CreateIndex
CREATE INDEX "Bakim_soforId_idx" ON "Bakim"("soforId");

-- CreateIndex
CREATE INDEX "Bakim_sirketId_idx" ON "Bakim"("sirketId");

-- CreateIndex
CREATE INDEX "Bakim_deletedAt_idx" ON "Bakim"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArizaKaydi_bakimId_key" ON "ArizaKaydi"("bakimId");

-- CreateIndex
CREATE INDEX "ArizaKaydi_aracId_idx" ON "ArizaKaydi"("aracId");

-- CreateIndex
CREATE INDEX "ArizaKaydi_kullaniciId_idx" ON "ArizaKaydi"("kullaniciId");

-- CreateIndex
CREATE INDEX "ArizaKaydi_sirketId_idx" ON "ArizaKaydi"("sirketId");

-- CreateIndex
CREATE INDEX "ArizaKaydi_durum_idx" ON "ArizaKaydi"("durum");

-- CreateIndex
CREATE INDEX "ArizaKaydi_bildirimTarihi_idx" ON "ArizaKaydi"("bildirimTarihi");

-- CreateIndex
CREATE INDEX "Ceza_plaka_idx" ON "Ceza"("plaka");

-- CreateIndex
CREATE INDEX "Ceza_kullaniciId_idx" ON "Ceza"("kullaniciId");

-- CreateIndex
CREATE INDEX "Ceza_aracId_idx" ON "Ceza"("aracId");

-- CreateIndex
CREATE INDEX "Ceza_sirketId_idx" ON "Ceza"("sirketId");

-- CreateIndex
CREATE INDEX "Ceza_deletedAt_idx" ON "Ceza"("deletedAt");

-- CreateIndex
CREATE INDEX "Masraf_aracId_idx" ON "Masraf"("aracId");

-- CreateIndex
CREATE INDEX "Masraf_sirketId_idx" ON "Masraf"("sirketId");

-- CreateIndex
CREATE INDEX "Masraf_deletedAt_idx" ON "Masraf"("deletedAt");

-- CreateIndex
CREATE INDEX "Yakit_aracId_idx" ON "Yakit"("aracId");

-- CreateIndex
CREATE INDEX "Yakit_sirketId_idx" ON "Yakit"("sirketId");

-- CreateIndex
CREATE INDEX "Yakit_tarih_idx" ON "Yakit"("tarih");

-- CreateIndex
CREATE INDEX "Yakit_soforId_idx" ON "Yakit"("soforId");

-- CreateIndex
CREATE INDEX "YakitTank_aktifMi_idx" ON "YakitTank"("aktifMi");

-- CreateIndex
CREATE INDEX "YakitTank_sirketId_idx" ON "YakitTank"("sirketId");

-- CreateIndex
CREATE UNIQUE INDEX "YakitTankHareket_yakitId_key" ON "YakitTankHareket"("yakitId");

-- CreateIndex
CREATE INDEX "YakitTankHareket_tip_idx" ON "YakitTankHareket"("tip");

-- CreateIndex
CREATE INDEX "YakitTankHareket_tarih_idx" ON "YakitTankHareket"("tarih");

-- CreateIndex
CREATE INDEX "YakitTankHareket_tankId_idx" ON "YakitTankHareket"("tankId");

-- CreateIndex
CREATE INDEX "YakitTankHareket_hedefTankId_idx" ON "YakitTankHareket"("hedefTankId");

-- CreateIndex
CREATE INDEX "YakitTankHareket_aracId_idx" ON "YakitTankHareket"("aracId");

-- CreateIndex
CREATE INDEX "YakitTankHareket_soforId_idx" ON "YakitTankHareket"("soforId");

-- CreateIndex
CREATE INDEX "HgsYukleme_aracId_idx" ON "HgsYukleme"("aracId");

-- CreateIndex
CREATE INDEX "HgsYukleme_sirketId_idx" ON "HgsYukleme"("sirketId");

-- CreateIndex
CREATE INDEX "HgsYukleme_tarih_idx" ON "HgsYukleme"("tarih");

-- CreateIndex
CREATE INDEX "ActivityLog_actionType_idx" ON "ActivityLog"("actionType");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_idx" ON "ActivityLog"("entityType");

-- CreateIndex
CREATE INDEX "ActivityLog_entityId_idx" ON "ActivityLog"("entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_companyId_idx" ON "ActivityLog"("companyId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "Dokuman_aracId_idx" ON "Dokuman"("aracId");

-- CreateIndex
CREATE INDEX "Dokuman_sirketId_idx" ON "Dokuman"("sirketId");

-- CreateIndex
CREATE INDEX "Dokuman_deletedAt_idx" ON "Dokuman"("deletedAt");

-- CreateIndex
CREATE INDEX "StokKalem_sirketId_idx" ON "StokKalem"("sirketId");

-- CreateIndex
CREATE INDEX "StokKalem_ad_idx" ON "StokKalem"("ad");

-- CreateIndex
CREATE INDEX "SigortaTeklif_aracId_idx" ON "SigortaTeklif"("aracId");

-- CreateIndex
CREATE INDEX "SigortaTeklif_bitisTarihi_idx" ON "SigortaTeklif"("bitisTarihi");

-- CreateIndex
CREATE INDEX "SigortaTeklif_durum_idx" ON "SigortaTeklif"("durum");

-- CreateIndex
CREATE INDEX "SigortaTeklif_olusturulanKayitId_idx" ON "SigortaTeklif"("olusturulanKayitId");

-- CreateIndex
CREATE INDEX "SigortaTeklif_sirketId_idx" ON "SigortaTeklif"("sirketId");

-- AddForeignKey
ALTER TABLE "Arac" ADD CONSTRAINT "Arac_disFirmaId_fkey" FOREIGN KEY ("disFirmaId") REFERENCES "DisFirma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arac" ADD CONSTRAINT "Arac_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Personel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arac" ADD CONSTRAINT "Arac_sirketId_fkey" FOREIGN KEY ("sirketId") REFERENCES "Sirket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personel" ADD CONSTRAINT "Personel_disFirmaId_fkey" FOREIGN KEY ("disFirmaId") REFERENCES "DisFirma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personel" ADD CONSTRAINT "Personel_sirketId_fkey" FOREIGN KEY ("sirketId") REFERENCES "Sirket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KullaniciYetkiliSirket" ADD CONSTRAINT "KullaniciYetkiliSirket_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Personel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KullaniciYetkiliSirket" ADD CONSTRAINT "KullaniciYetkiliSirket_sirketId_fkey" FOREIGN KEY ("sirketId") REFERENCES "Sirket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonelZimmet" ADD CONSTRAINT "PersonelZimmet_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonelZimmet" ADD CONSTRAINT "PersonelZimmet_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Personel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hesap" ADD CONSTRAINT "Hesap_personelId_fkey" FOREIGN KEY ("personelId") REFERENCES "Personel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafikSigortasi" ADD CONSTRAINT "TrafikSigortasi_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kasko" ADD CONSTRAINT "Kasko_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Muayene" ADD CONSTRAINT "Muayene_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bakim" ADD CONSTRAINT "Bakim_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bakim" ADD CONSTRAINT "Bakim_soforId_fkey" FOREIGN KEY ("soforId") REFERENCES "Personel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArizaKaydi" ADD CONSTRAINT "ArizaKaydi_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArizaKaydi" ADD CONSTRAINT "ArizaKaydi_bakimId_fkey" FOREIGN KEY ("bakimId") REFERENCES "Bakim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArizaKaydi" ADD CONSTRAINT "ArizaKaydi_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Personel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ceza" ADD CONSTRAINT "Ceza_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ceza" ADD CONSTRAINT "Ceza_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Personel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Masraf" ADD CONSTRAINT "Masraf_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Yakit" ADD CONSTRAINT "Yakit_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Yakit" ADD CONSTRAINT "Yakit_soforId_fkey" FOREIGN KEY ("soforId") REFERENCES "Personel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YakitTank" ADD CONSTRAINT "YakitTank_sirketId_fkey" FOREIGN KEY ("sirketId") REFERENCES "Sirket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YakitTankHareket" ADD CONSTRAINT "YakitTankHareket_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YakitTankHareket" ADD CONSTRAINT "YakitTankHareket_hedefTankId_fkey" FOREIGN KEY ("hedefTankId") REFERENCES "YakitTank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YakitTankHareket" ADD CONSTRAINT "YakitTankHareket_soforId_fkey" FOREIGN KEY ("soforId") REFERENCES "Personel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YakitTankHareket" ADD CONSTRAINT "YakitTankHareket_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "YakitTank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YakitTankHareket" ADD CONSTRAINT "YakitTankHareket_yakitId_fkey" FOREIGN KEY ("yakitId") REFERENCES "Yakit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HgsYukleme" ADD CONSTRAINT "HgsYukleme_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dokuman" ADD CONSTRAINT "Dokuman_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokKalem" ADD CONSTRAINT "StokKalem_sirketId_fkey" FOREIGN KEY ("sirketId") REFERENCES "Sirket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigortaTeklif" ADD CONSTRAINT "SigortaTeklif_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
