import { Prisma, $Enums } from "@prisma/client";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { EXCEL_ENTITY_CONFIG, isExcelEntityKey, ExcelEntityKey } from "@/lib/excel-entities";
import type { ExternalVendorMode } from "@/lib/external-vendor-mode";
import { KIRALIK_SIRKET_ADI, isKiralikSirketName } from "@/lib/ruhsat-sahibi";

// --- Re-exports ---
export { ensureBakimColumns, isBakimSchemaCompatibilityError } from "@/lib/bakim-schema-compat";
export { ensureCezaFineTrackingColumns, isCezaSchemaCompatibilityError } from "@/lib/ceza-schema-compat";
export { syncAracGuncelKm } from "@/lib/km-consistency";

export function getEntityOrNull(entity: string) {
    return isExcelEntityKey(entity) ? EXCEL_ENTITY_CONFIG[entity] : null;
}

// --- Types ---
export type RowData = Record<string, unknown>;
export type WhereData = Record<string, unknown>;
export type ExportColumn =
    | { key: string; type: "scalar"; fieldName: string }
    | {
        key: string;
        type: "relationLookup";
        relationFieldName: string;
        relationModelName: string;
        foreignKeyFieldName: string;
    };

export type ModelDelegate = {
    findMany?: (args?: {
        where?: WhereData;
        orderBy?: Record<string, "asc" | "desc">;
        include?: Record<string, unknown>;
        select?: Record<string, boolean>;
        take?: number;
    }) => Promise<RowData[]>;
    create?: (args: { data: RowData; select?: Record<string, boolean> }) => Promise<unknown>;
    update?: (args: { where: WhereData; data: RowData; select?: Record<string, boolean> }) => Promise<unknown>;
    upsert?: (args: { where: WhereData; create: RowData; update: RowData }) => Promise<unknown>;
    findUnique?: (args: { where: WhereData; select: Record<string, boolean> }) => Promise<RowData | null>;
};

export type PrismaField = (typeof Prisma.dmmf.datamodel.models)[number]["fields"][number];

export type ExcelModelProfile = {
    visibleColumns?: string[];
    hiddenColumns?: string[];
    labels?: Record<string, string>;
    aliases?: Record<string, string[]>;
    strictVisibleColumns?: boolean;
};

export type ImportEntityOptions = {
    selectedDisFirmaId?: string | null;
    selectedExternalMode?: ExternalVendorMode | null;
};

// --- Config & Constants ---
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

export function parseSelectedYil(val: string | null | undefined): number | null {
    if (!val) return null;
    const parsed = parseInt(val);
    return isNaN(parsed) ? null : parsed;
}

export const EXCEL_MODEL_PROFILES: Record<string, ExcelModelProfile> = {
    arac: {
        visibleColumns: [
            "durum",
            "plaka",
            "ruhsatSahibi",
            "calistigiKurum",
            "saseNo",
            "motorNo",
            "kategori",
            "marka",
            "model",
            "yil",
            "bulunduguIl",
            "bedel",
            "guncelKm",
            "kullanici",
            "ruhsatSeriNo",
            "aciklama",
        ],
        hiddenColumns: ["olusturmaTarihi", "guncellemeTarihi"],
        labels: {
            durum: "Durum",
            plaka: "Plaka",
            ruhsatSahibi: "Ruhsat Sahibi",
            disFirma: "Dış Firma",
            calistigiKurum: "Kullanıcı Firma",
            saseNo: "Şase No",
            motorNo: "Motor No",
            kategori: "Kategori",
            marka: "Marka",
            model: "Model",
            yil: "Model Yılı",
            bulunduguIl: "Bulunduğu Şantiye",
            bedel: "BEDEL",
            guncelKm: "KM",
            kullanici: "Kullanıcı",
            ruhsatSeriNo: "Ruhsat Seri No",
            aciklama: "Açıklama",
        },
        aliases: {
            ruhsatSahibi: [
                "Ruhsat Sahibi Firma",
                "operasyonFirma",
                "operasyonFirmasi",
                "ruhsatSahibiFirma",
                "ruhsatSahibiFirmasi",
                "sirket",
                "bagliSirket",
            ],
            disFirma: [
                "disFirma",
                "Dış Firma",
                "Dis Firma",
                "Dış Firma (Taşeron / Kiralık)",
                "Dis Firma (Taseron / Kiralik)",
                "Kiralık Firma",
                "Kiralik Firma",
                "Taşeron Firma",
                "Taseron Firma",
                "Araç Sahibi Dış Firma",
                "Arac Sahibi Dis Firma",
            ],
            calistigiKurum: [
                "Kullanıcı Firma",
                "Kullanıcı Firması",
                "Kullanici Firma",
                "Kullanici Firmasi",
                "kullanici firma",
                "kullanici firmasi",
                "kullaniciFirma",
                "kullaniciFirmasi",
                "Çalıştığı Kurum",
                "Calistigi Kurum",
            ],
            guncelKm: ["Güncel KM", "km", "Km"],
            kullanici: ["Sofor", "Şoför", "sofor"],
            bulunduguIl: ["Bulunduğu İl", "Bulunduğu Şantiye", "Şantiye", "İl", "il"],
            yil: ["Yıl", "yil"],
            bedel: ["Bedel", "alış bedeli", "alis bedeli", "alış maliyeti", "alis maliyeti"],
            aciklama: ["Açiklama", "aciklama"],
            saseNo: ["Şase No", "Şase Numarası", "Sase No", "Sase Numarası"],
            motorNo: ["Motor No", "Motor Numarası", "Motor", "motor"],
        },
    },
    kullanici: {
        visibleColumns: [
            "ad",
            "soyad",
            "telefon",
            "tcNo",
            "calistigiKurum",
            "rol",
            "sirket",
            "zimmetliArac",
            "onayDurumu",
            "eposta",
        ],
        hiddenColumns: ["deletedAt", "deletedBy"],
        labels: {
            ad: "Ad",
            soyad: "Soyad",
            telefon: "Telefon",
            tcNo: "TC Kimlik No",
            calistigiKurum: "Çalıştığı Kurum",
            rol: "Rol",
            sirket: "Çalıştığı Firma",
            disFirma: "Dış Firma",
            zimmetliArac: "Zimmetli Araç",
            onayDurumu: "Onay Durumu",
            eposta: "E-Posta",
        },
        aliases: {
            calistigiKurum: [
                "Çalıştığı Kurum",
                "Calistigi Kurum",
                "Kurum",
                "Çalıştığı Firma",
                "Calistigi Firma",
                "Şehir",
                "Sehir",
                "sehir",
            ],
            sirket: [
                "Çalıştığı Firma",
                "Calistigi Firma",
                "Bağlı Şirket",
                "Bagli Sirket",
                "Şirket",
                "Sirket",
            ],
            disFirma: [
                "Dış Firma",
                "Dis Firma",
                "Kiralık Firma",
                "Kiralik Firma",
                "Taşeron Firma",
                "Taseron Firma",
                "Firma",
                "Firması",
            ],
            zimmetliArac: ["Zimmetli Araç", "Zimmetli Arac", "Plaka", "Araç", "Arac"],
            tcNo: ["TC No", "TCKN", "TC Kimlik"],
            eposta: ["Eposta", "Mail"],
        },
    },
    disFirma: {
        visibleColumns: [
            "ad",
            "calistigiKurum",
            "sehir",
            "vergiNo",
            "yetkiliKisi",
            "telefon",
        ],
        strictVisibleColumns: true,
        labels: {
            ad: "Firma Adı",
            calistigiKurum: "Çalıştığı Kurum",
            tur: "Firma Türü",
            sehir: "Şehir",
            vergiNo: "Vergi No",
            yetkiliKisi: "Yetkili Kişi",
            telefon: "Telefon",
        },
        aliases: {
            ad: ["Firma", "Firma Adı", "Firma Adi", "Şirket Adı", "Sirket Adi"],
            calistigiKurum: ["Çalıştığı Kurum", "Calistigi Kurum", "Hangi Şirketimize Çalışıyor", "Hangi Sirketimize Calisiyor"],
            tur: ["Tür", "Tur", "Firma Türü", "Firma Turu"],
            sehir: ["Şehir", "Sehir", "İl", "Il"],
            vergiNo: ["Vergi No", "Vergi Numarası", "Vergi Numarasi"],
            yetkiliKisi: ["Yetkili", "Yetkili Kişi", "Yetkili Kisi"],
            telefon: ["Telefon", "Tel", "GSM"],
        },
    },
    yakit: {
        visibleColumns: [
            "tarih",
            "arac",
            "endeks",
            "sofor",
            "km",
            "litre",
            "istasyon",
        ],
        strictVisibleColumns: true,
        labels: {
            tarih: "Tarih Saat",
            arac: "Araç Plakası",
            bagliSirket: "Bağlı Şirket",
            calistigiKurum: "Çalıştığı Kurum",
            endeks: "Endeks",
            sofor: "Yakıt Alan Personel",
            km: "KM/Saat",
            litre: "Alınan Litre",
            istasyon: "Yakıt Çıkışı",
        },
        aliases: {
            tarih: ["Tarih", "Tarih Saati", "Alım Tarihi", "Alim Tarihi", "Alım Tarihi & Saati"],
            arac: ["Araç", "Arac", "Plaka", "Araç Plakası", "Arac Plakasi"],
            bagliSirket: ["Bağlı Şirket", "Bagli Sirket", "Ruhsat Sahibi", "Şirket", "Sirket"],
            calistigiKurum: ["Çalıştığı Kurum", "Calistigi Kurum", "Kullanıcı Firma", "Kullanici Firma"],
            endeks: ["Endeks", "Mithra Endeks", "Sayaç", "Sayac"],
            sofor: ["Yakıtı Alan", "Yakit Alan", "Yakıtı Alan Personel", "Yakıt Alan Personel", "Şoför", "Sofor", "Personel", "Kullanıcı", "Kullanici", "Sürücü", "Surucu"],
            km: ["KM", "Km", "km", "KM/Saat", "Alım KM", "Alim KM"],
            litre: ["Litre", "Alınan Litre", "Alinan Litre"],
            istasyon: ["Yakıt Çıkışı", "Yakit Cikisi", "Alındığı Yer", "Alindigi Yer", "İstasyon", "Istasyon", "Yakıt Alım Yeri", "Yakit Alim Yeri"],
        },
    },
    bakim: {
        visibleColumns: [
            "bakimTarihi",
            "arac",
            "sofor",
            "arizaSikayet",
            "yapilanIslemler",
            "degisenParca",
            "islemYapanFirma",
            "yapilanKm",
            "tutar",
        ],
        strictVisibleColumns: true,
        labels: {
            bakimTarihi: "Bakım Tarihi",
            arac: "Plaka",
            sofor: "Şoför",
            arizaSikayet: "Arıza Şikayet",
            yapilanIslemler: "Yapılan İşlem",
            degisenParca: "Değişen Parça",
            islemYapanFirma: "İşlem Yapan Firma",
            yapilanKm: "Yapılan KM",
            tutar: "Masraf Tutarı",
        },
        aliases: {
            sofor: ["Şoför", "Sofor", "Servise Götüren", "Servise Goturen", "Personel", "Kullanıcı", "Kullanici"],
            bakimTarihi: ["Tarih"],
            arac: ["Araç", "Arac", "Plaka", "Araç Plakası", "Arac Plakasi"],
            arizaSikayet: ["Arıza Şikayet", "Ariza Sikayet", "Arıza Şikayeti", "Ariza Sikayeti", "Şikayet", "Sikayet", "Arıza Açıklama", "Ariza Aciklama"],
            yapilanIslemler: ["Yapılan İşlem", "Yapılan İşlemler", "Yapilan Islem", "Yapilan Islemler", "İşlem", "Islem"],
            degisenParca: ["Değişen Parça", "Degisen Parca", "Değişen Parçalar", "Degisen Parcalar"],
            islemYapanFirma: ["İşlem Yapan Firma", "Islem Yapan Firma", "Servis Adı", "Servis Adi", "Servis Firması", "Servis Firmasi"],
            yapilanKm: ["Yapılan KM", "Yapilan KM", "KM", "Yapılan Kilometre", "Servis KM"],
            tutar: ["Tutar", "Masraf", "Masraf Tutarı", "Masraf Tutari"],
        },
    },
    muayene: {
        visibleColumns: ["arac", "muayeneTarihi", "gecerlilikTarihi", "km", "tutar"],
        strictVisibleColumns: true,
        labels: {
            arac: "Araç Plakas",
            muayeneTarihi: "Muayene Tarihi",
            gecerlilikTarihi: "Geçerlilik Tarihi",
            km: "KM",
            tutar: "Tutar",
        },
        aliases: {
            arac: ["Araç", "Arac", "Plaka", "Araç Plakası", "Arac Plakasi"],
            muayeneTarihi: ["Tarih", "Muayene Tarihi", "Yapıldığı Tarih", "Yapildigi Tarih"],
            gecerlilikTarihi: ["Vize Bitiş", "Geçerlilik Bitiş", "Gecerlilik Bitis", "Bitiş Tarihi", "Bitis Tarihi"],
            km: ["KM", "Muayene KM", "Kilometre"],
            tutar: ["Tutar", "Muayene Ücreti", "Ucret"],
        },
    },
    kasko: {
        visibleColumns: [
            "arac",
            "sirket",
            "policeNo",
            "acente",
            "baslangicTarihi",
            "bitisTarihi",
            "tutar",
        ],
        strictVisibleColumns: true,
        labels: {
            aktifMi: "Mevcut Durum",
            arac: "Araç Plakası",
            bagliSirket: "Ruhsat Sahibi",
            calistigiKurum: "Kullanıcı Firma",
            sirket: "Sigorta Şirketi",
            policeNo: "Poliçe No",
            acente: "Acente",
            baslangicTarihi: "Başlangıç Tarihi",
            bitisTarihi: "Bitiş Tarihi",
            tutar: "Poliçe Tutarı",
        },
        aliases: {
            aktifMi: ["Durum", "AktifMi", "Poliçe Durumu"],
            arac: ["Araç", "Arac", "Plaka", "Araç Plakası", "Arac Plakasi"],
            sirket: ["Şirket", "Sigorta Şirketi", "Sigorta Sirketi", "Kasko Firması", "Kasko Firmasi"],
            policeNo: ["Poliçe No", "Police No", "Poliçe Numarası", "Police Numarasi", "Police"],
            acente: ["Acente", "Aracı Kurum"],
            baslangicTarihi: ["Başlangıç Tarihi", "Baslangic Tarihi", "Başlangıç", "Baslangic", "Tarih"],
            bitisTarihi: ["Bitiş Tarihi", "Bitis Tarihi", "Bitiş", "Bitis", "Geçerlilik Bitiş", "Gecerlilik Bitis"],
            tutar: ["Poliçe Tutarı", "Police Tutari", "Tutar", "Maliyet"],
        },
    },
    trafikSigortasi: {
        visibleColumns: [
            "arac",
            "sirket",
            "policeNo",
            "acente",
            "baslangicTarihi",
            "bitisTarihi",
            "tutar",
        ],
        strictVisibleColumns: true,
        labels: {
            aktifMi: "Mevcut Durum",
            arac: "Araç Plakası",
            bagliSirket: "Ruhsat Sahibi",
            calistigiKurum: "Kullanıcı Firma",
            sirket: "Sigorta Şirketi",
            policeNo: "Poliçe No",
            acente: "Acente",
            baslangicTarihi: "Başlangıç Tarihi",
            bitisTarihi: "Bitiş Tarihi",
            tutar: "Poliçe Tutarı",
        },
        aliases: {
            aktifMi: ["Durum", "AktifMi", "Poliçe Durumu"],
            arac: ["Araç", "Arac", "Plaka", "Araç Plakası", "Arac Plakasi"],
            sirket: ["Şirket", "Sigorta Şirketi", "Sigorta Sirketi", "Sigorta Firması", "Sigorta Firmasi"],
            policeNo: ["Poliçe No", "Police No", "Poliçe Numarası", "Police Numarasi", "Police"],
            acente: ["Acente", "Aracı Kurum"],
            baslangicTarihi: ["Başlangıç Tarihi", "Baslangic Tarihi", "Başlangıç", "Baslangic", "Tarih"],
            bitisTarihi: ["Bitiş Tarihi", "Bitis Tarihi", "Bitiş", "Bitis", "Geçerlilik Bitiş", "Gecerlilik Bitis"],
            tutar: ["Poliçe Tutarı", "Police Tutari", "Tutar", "Maliyet"],
        },
    },
    ceza: {
        visibleColumns: ["tarih", "arac", "sofor", "cezaMaddesi", "tutar", "aciklama"],
        strictVisibleColumns: true,
        labels: {
            tarih: "Ceza Tarihi",
            arac: "Plaka",
            sofor: "Şoför",
            cezaMaddesi: "Ceza Maddesi",
            tutar: "Tutar",
            aciklama: "Açıklama",
        },
        aliases: {
            tarih: ["Tarih", "Ceza Tarihi", "Tarih Saat"],
            arac: ["Araç", "Arac", "Plaka", "Araç Plakası"],
            sofor: ["Şoför", "Sofor", "Personel", "Sürücü"],
            cezaMaddesi: ["Ceza Maddesi", "Madde", "İhlal"],
            tutar: ["Tutar", "Ceza Tutarı", "Bedel"],
        },
    },
    masraf: {
        visibleColumns: ["tarih", "arac", "kategori", "tutar", "aciklama"],
        strictVisibleColumns: true,
        labels: {
            tarih: "Tarih",
            arac: "Plaka",
            kategori: "Kategori",
            tutar: "Tutar",
            aciklama: "Açıklama",
        },
        aliases: {
            arac: ["Araç", "Arac", "Plaka"],
            tutar: ["Tutar", "Bedel", "Maliyet"],
            kategori: ["Tür", "Masraf Türü"],
        },
    },
    arizaKaydi: {
        visibleColumns: ["bildirimTarihi", "arac", "bildirenSofor", "aciklama", "durum"],
        strictVisibleColumns: true,
        labels: {
            bildirimTarihi: "Bildirim Tarihi",
            arac: "Plaka",
            bildirenSofor: "Bildiren Şoför",
            aciklama: "Arıza Açıklaması",
            durum: "Durum",
        },
        aliases: {
            arac: ["Araç", "Arac", "Plaka"],
            bildirenSofor: ["Şoför", "Sofor", "Bildiren"],
        },
    },
    kullaniciZimmet: {
        visibleColumns: ["arac", "kullanici", "baslangic", "bitis", "baslangicKm", "bitisKm", "notlar"],
        strictVisibleColumns: true,
        labels: {
            arac: "Plaka",
            kullanici: "Zimmetlenen Personel",
            baslangic: "Başlangıç Tarihi",
            bitis: "Bitiş Tarihi",
            baslangicKm: "Başlangıç KM",
            bitisKm: "Bitiş KM",
            notlar: "Açıklama",
        },
        aliases: {
            arac: ["Araç", "Arac", "Plaka"],
            kullanici: ["Personel", "Şoför", "Sofor", "Kullanıcı"],
            baslangic: ["Başlangıç", "Baslangic", "Zimmet Tarihi"],
            bitis: ["Bitiş", "Bitis", "İade Tarihi"],
            baslangicKm: ["Başlangıç KM", "Baslangic KM", "KM", "Teslim KM"],
            bitisKm: ["Bitiş KM", "Bitis KM", "İade KM"],
            notlar: ["Açıklama", "Not", "Notlar", "aciklama"],
        },
    },
    dokuman: {
        visibleColumns: ["yuklemeTarihi", "arac", "kategori", "aciklama"],
        strictVisibleColumns: true,
        labels: {
            yuklemeTarihi: "Yükleme Tarihi",
            arac: "Plaka",
            kategori: "Kategori",
            aciklama: "Açıklama",
        },
        aliases: {
            arac: ["Araç", "Arac", "Plaka"],
        },
    },
};

const ARAC_EXTERNAL_VISIBLE_COLUMNS = [
    "plaka",
    "ruhsatSahibi",
    "disFirma",
    "kullanici",
];

const ARAC_TASERON_VISIBLE_COLUMNS = [
    "durum",
    "plaka",
    "ruhsatSahibi",
    "disFirma",
    "calistigiKurum",
    "saseNo",
    "motorNo",
    "kategori",
    "marka",
    "model",
    "yil",
    "bulunduguIl",
    "bedel",
    "guncelKm",
    "kullanici",
    "ruhsatSeriNo",
    "aciklama",
];

const PERSONEL_EXTERNAL_VISIBLE_COLUMNS = [
    "ad",
    "soyad",
    "telefon",
    "sirket",
    "disFirma",
    "zimmetliArac",
];

const PERSONEL_TASERON_VISIBLE_COLUMNS = [
    "ad",
    "soyad",
    "telefon",
    "tcNo",
    "calistigiKurum",
    "rol",
    "sirket",
    "disFirma",
    "zimmetliArac",
    "onayDurumu",
    "eposta",
];

EXCEL_MODEL_PROFILES.kiralikArac = {
    ...(EXCEL_MODEL_PROFILES.arac || {}),
    visibleColumns: ARAC_EXTERNAL_VISIBLE_COLUMNS,
    labels: {
        ...(EXCEL_MODEL_PROFILES.arac?.labels || {}),
        ruhsatSahibi: "Çalıştığı Firmamız",
        disFirma: "Taşeron Firma",
        kullanici: "Şoför",
    },
    aliases: {
        ...(EXCEL_MODEL_PROFILES.arac?.aliases || {}),
        ruhsatSahibi: [
            ...(EXCEL_MODEL_PROFILES.arac?.aliases?.ruhsatSahibi || []),
            "Çalıştığı Firmamız",
            "Calistigi Firmamiz",
            "Çalıştığı Firma",
            "Calistigi Firma",
        ],
        disFirma: [
            ...(EXCEL_MODEL_PROFILES.arac?.aliases?.disFirma || []),
            "Taşeron Firma",
            "Taseron Firma",
            "Kiralık Firma",
            "Kiralik Firma",
        ],
        kullanici: [
            ...(EXCEL_MODEL_PROFILES.arac?.aliases?.kullanici || []),
            "Şoför",
            "Sofor",
            "Sürücü",
            "Surucu",
        ],
    },
};

EXCEL_MODEL_PROFILES.taseronArac = {
    ...(EXCEL_MODEL_PROFILES.arac || {}),
    visibleColumns: ARAC_TASERON_VISIBLE_COLUMNS,
};

EXCEL_MODEL_PROFILES.kiralikPersonel = {
    ...(EXCEL_MODEL_PROFILES.kullanici || {}),
    visibleColumns: PERSONEL_EXTERNAL_VISIBLE_COLUMNS,
    labels: {
        ...(EXCEL_MODEL_PROFILES.kullanici?.labels || {}),
        sirket: "Çalıştığı Firmamız",
        disFirma: "Taşeron Firma",
        zimmetliArac: "Araç Plakası",
    },
    aliases: {
        ...(EXCEL_MODEL_PROFILES.kullanici?.aliases || {}),
        sirket: [
            ...(EXCEL_MODEL_PROFILES.kullanici?.aliases?.sirket || []),
            "Çalıştığı Firmamız",
            "Calistigi Firmamiz",
        ],
        disFirma: [
            ...(EXCEL_MODEL_PROFILES.kullanici?.aliases?.disFirma || []),
            "Taşeron Firma",
            "Taseron Firma",
            "Kiralık Firma",
            "Kiralik Firma",
        ],
    },
};

EXCEL_MODEL_PROFILES.taseronPersonel = {
    ...(EXCEL_MODEL_PROFILES.kullanici || {}),
    visibleColumns: PERSONEL_TASERON_VISIBLE_COLUMNS,
};

const ENUM_INPUT_ALIASES: Record<string, Record<string, string>> = {
    AracKategori: {
        TIR: "SANTIYE",
        KAMYON: "SANTIYE",
        "KAMYON TIR": "SANTIYE",
        "KAMYON/TIR": "SANTIYE",
        "SANTIYE ARACI": "SANTIYE",
        SANTIYE: "SANTIYE",
        "BINEK ARAC": "BINEK",
        "IS MAKINESI": "SANTIYE",
        "IS MAKINASI": "SANTIYE",
        "IS_MAKINASI": "SANTIYE",
        "IS MAKINESI ARACI": "SANTIYE",
    },
    AracDurumu: {
        AKTIFTE: "AKTIF",
        BOS: "BOSTA",
    },
    Rol: {
        SURUCU: "PERSONEL",
    },
};

const NULLISH_CELL_TOKENS = new Set([
    "-",
    "--",
    "—",
    "n/a",
    "na",
    "null",
    "none",
    "nil",
    "yok",
    "bos",
    "boş",
]);

const ARAC_IMPORT_ALLOWED_COLUMNS = new Set([
    "plaka",
    "marka",
    "model",
    "yil",
    "bulunduguIl",
    "guncelKm",
    "bedel",
    "aciklama",
    "ruhsatSeriNo",
    "durum",
    "kullaniciId",
    "sirketId",
    "disFirmaId",
    "calistigiKurum",
    "kategori",
    "saseNo",
    "motorNo",
    "deletedAt",
    "deletedBy",
]);

type EntityImportScope = {
    forceInternal: boolean;
    fixedDisFirmaTuru: ExternalVendorMode | null;
};

function normalizeOptionalId(value: string | null | undefined) {
    const normalized = (value || "").trim();
    return normalized.length > 0 ? normalized : null;
}

function normalizeExternalVendorMode(value: ExternalVendorMode | string | null | undefined): ExternalVendorMode | null {
    const normalized = String(value || "").trim().toUpperCase();
    if (normalized === "KIRALIK" || normalized === "TASERON") {
        return normalized;
    }
    return null;
}

function getEntityImportScope(entityKey: string, options?: ImportEntityOptions): EntityImportScope {
    const explicitMode = normalizeExternalVendorMode(options?.selectedExternalMode);
    if (entityKey === "arac" || entityKey === "personel") {
        return { forceInternal: true, fixedDisFirmaTuru: null };
    }
    if (entityKey === "kiralikArac" || entityKey === "kiralikPersonel") {
        return { forceInternal: false, fixedDisFirmaTuru: "KIRALIK" };
    }
    if (entityKey === "taseronArac" || entityKey === "taseronPersonel") {
        return { forceInternal: false, fixedDisFirmaTuru: "TASERON" };
    }
    if (explicitMode) {
        return { forceInternal: false, fixedDisFirmaTuru: explicitMode };
    }
    return { forceInternal: false, fixedDisFirmaTuru: null };
}

async function validateDisFirmaIdForImportScope(
    tx: unknown,
    disFirmaId: unknown,
    expectedTur: ExternalVendorMode,
    cache: Map<string, ExternalVendorMode | null>
) {
    const normalizedId = normalizeOptionalId(typeof disFirmaId === "string" ? disFirmaId : null);
    if (!normalizedId) return false;

    const cachedTur = cache.get(normalizedId);
    if (cachedTur !== undefined) {
        return cachedTur === expectedTur;
    }

    const disFirmaDelegate = getModelDelegate(tx, "disFirma");
    if (!disFirmaDelegate?.findUnique) {
        cache.set(normalizedId, null);
        return false;
    }

    const disFirma = await disFirmaDelegate.findUnique({
        where: { id: normalizedId },
        select: { tur: true },
    });
    const tur = normalizeExternalVendorMode(disFirma?.tur as string | null | undefined);
    cache.set(normalizedId, tur);
    return tur === expectedTur;
}

// --- Utility Functions ---

export function lowerFirst(value: string) {
    return value.charAt(0).toLowerCase() + value.slice(1);
}

export function getExcelProfileKey(modelName: string, entityKey?: string) {
    if (entityKey && EXCEL_MODEL_PROFILES[entityKey]) {
        return entityKey;
    }
    return modelName;
}

export function getExcelModelProfile(modelName: string): ExcelModelProfile | null {
    return EXCEL_MODEL_PROFILES[modelName] || null;
}

export function getExportHeaderLabel(modelName: string, key: string) {
    const profile = getExcelModelProfile(modelName);
    return profile?.labels?.[key] || key;
}

export function getHeaderAliases(modelName: string, key: string) {
    const profile = getExcelModelProfile(modelName);
    return profile?.aliases?.[key] || [];
}

export function normalizeHeaderToken(value: string) {
    return value
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/ı/g, "i")
        .replace(/İ/g, "i")
        .replace(/ş/g, "s")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9]/g, "");
}

export function buildHeaderIndex(headers: string[]) {
    const index = new Map<string, string>();
    for (const header of headers) {
        const normalized = normalizeHeaderToken(header);
        if (!normalized) continue;
        if (!index.has(normalized)) {
            index.set(normalized, header);
        }
        const dedupNormalized = normalized.replace(/\d+$/, "");
        if (dedupNormalized && dedupNormalized !== normalized && !index.has(dedupNormalized)) {
            index.set(dedupNormalized, header);
        }
    }
    return index;
}

export function findHeaderByCandidates(
    availableHeaders: Set<string>,
    normalizedHeaderIndex: Map<string, string>,
    candidates: string[]
) {
    for (const candidate of candidates) {
        if (availableHeaders.has(candidate)) {
            return candidate;
        }
        const normalized = normalizeHeaderToken(candidate);
        if (!normalized) continue;
        const matched = normalizedHeaderIndex.get(normalized);
        if (matched) return matched;
    }
    return null;
}

export function resolveImportHeaderForRecord(
    recordHeaders: Set<string>,
    normalizedRecordHeaderIndex: Map<string, string>,
    fallbackHeaders: Set<string>,
    fallbackNormalizedHeaderIndex: Map<string, string>,
    candidates: string[]
) {
    return (
        findHeaderByCandidates(recordHeaders, normalizedRecordHeaderIndex, candidates) ||
        findHeaderByCandidates(fallbackHeaders, fallbackNormalizedHeaderIndex, candidates)
    );
}

export function readRecordCellValue(
    record: Record<string, unknown>,
    header: string | null,
    normalizedRecordHeaderIndex: Map<string, string>
) {
    if (!header) return null;
    if (Object.prototype.hasOwnProperty.call(record, header)) {
        return record[header];
    }
    const normalized = normalizeHeaderToken(header);
    if (!normalized) return null;
    const matchedHeader = normalizedRecordHeaderIndex.get(normalized);
    return matchedHeader ? record[matchedHeader] : null;
}

export function getHeaderCandidates(modelName: string, key: string, extra: string[] = []) {
    const candidates = [key, getExportHeaderLabel(modelName, key), ...getHeaderAliases(modelName, key), ...extra];
    return [...new Set(candidates.filter((value) => value && value.trim().length > 0))];
}

export function extractSheetHeaders(sheet: XLSX.WorkSheet) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false,
    });
    const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
    return headerRow
        .map((cell) => {
            const normalized = normalizeCell(cell);
            return normalized === null ? null : String(normalized).trim();
        })
        .filter((header): header is string => Boolean(header));
}

export function applyExportProfile(modelName: string, columnKeys: string[]) {
    const profile = getExcelModelProfile(modelName);
    if (!profile) return columnKeys;

    let next = [...columnKeys];
    if (profile.hiddenColumns?.length) {
        const hidden = new Set(profile.hiddenColumns);
        next = next.filter((key) => !hidden.has(key));
    }
    if (profile.visibleColumns?.length) {
        const visibleSet = new Set(next);
        const ordered = profile.visibleColumns.filter((key) => visibleSet.has(key));
        if (profile.strictVisibleColumns) {
            next = [...new Set(profile.visibleColumns)];
        } else {
            const remaining = next.filter((key) => !ordered.includes(key));
            next = [...ordered, ...remaining];
        }
    }
    return next;
}


export function getModelMeta(prismaModel: string) {
    return Prisma.dmmf.datamodel.models.find((model) => lowerFirst(model.name) === prismaModel) || null;
}

export function getModelDelegate(source: unknown, modelName: string): ModelDelegate | null {
    if (!source || typeof source !== "object") return null;
    const delegate = (source as Record<string, unknown>)[modelName];
    if (!delegate || typeof delegate !== "object") return null;
    return delegate as ModelDelegate;
}

export function getColumnFields(model: NonNullable<ReturnType<typeof getModelMeta>>) {
    return model.fields.filter((field) => field.kind === "scalar" || field.kind === "enum");
}

export function getObjectFields(model: NonNullable<ReturnType<typeof getModelMeta>>) {
    return model.fields.filter((field) => field.kind === "object");
}

export function getRelationFromFields(field: PrismaField) {
    const relationFromFields = (field as PrismaField & { relationFromFields?: string[] | null }).relationFromFields;
    return Array.isArray(relationFromFields) ? relationFromFields : [];
}

export function buildRelationFieldByForeignKeyMap(model: NonNullable<ReturnType<typeof getModelMeta>>) {
    const relationFieldByForeignKey = new Map<string, PrismaField>();
    const objectFields = getObjectFields(model);
    const scalarFieldNames = new Set(
        model.fields
            .filter((field) => field.kind === "scalar" || field.kind === "enum")
            .map((field) => field.name)
    );

    for (const objectField of objectFields) {
        for (const foreignKeyField of getRelationFromFields(objectField)) {
            relationFieldByForeignKey.set(foreignKeyField, objectField);
        }
    }

    for (const objectField of objectFields) {
        const foreignKeyCandidate = `${objectField.name}Id`;
        if (!relationFieldByForeignKey.has(foreignKeyCandidate) && scalarFieldNames.has(foreignKeyCandidate)) {
            relationFieldByForeignKey.set(foreignKeyCandidate, objectField);
        }
    }

    if (model.name === "Arac") {
        const objectFieldByName = new Map(objectFields.map((field) => [field.name, field]));
        const sirketField = objectFieldByName.get("sirket");
        const kullaniciField = objectFieldByName.get("kullanici");
        const disFirmaField = objectFieldByName.get("disFirma");
        if (!relationFieldByForeignKey.has("sirketId") && sirketField) {
            relationFieldByForeignKey.set("sirketId", sirketField);
        }
        if (!relationFieldByForeignKey.has("kullaniciId") && kullaniciField) {
            relationFieldByForeignKey.set("kullaniciId", kullaniciField);
        }
        if (!relationFieldByForeignKey.has("disFirmaId") && disFirmaField) {
            relationFieldByForeignKey.set("disFirmaId", disFirmaField);
        }
    }

    return relationFieldByForeignKey;
}

export function shouldHideInternalField(fieldName: string) {
    if (fieldName === "id" || fieldName === "sifre") return true;
    if (fieldName === "sifreHash") return true;
    if (fieldName === "deletedAt" || fieldName === "deletedBy") return true;
    if (fieldName === "olusturmaTarihi" || fieldName === "guncellemeTarihi") return true;
    if (fieldName.endsWith("Id")) return true;
    return false;
}

export function buildRelationExportSelect(modelName: string) {
    if (modelName === "Kullanici") {
        return {
            ad: true,
            soyad: true,
            tcNo: true,
            eposta: true,
            calistigiKurum: true,
            sirket: { select: { ad: true } },
            arac: { select: { plaka: true, marka: true, model: true } },
        };
    }

    const modelMeta = Prisma.dmmf.datamodel.models.find((model) => model.name === modelName);
    if (!modelMeta) {
        return { id: true };
    }

    const scalarFields = modelMeta.fields.filter((field) => field.kind === "scalar" || field.kind === "enum");
    const selected = scalarFields
        .map((field) => field.name)
        .filter((fieldName) => !["sifre", "sifreHash", "deletedAt", "deletedBy"].includes(fieldName));

    if (selected.length === 0) {
        const fallback = scalarFields.find((field) => !field.isId)?.name ?? scalarFields[0]?.name ?? "id";
        return { [fallback]: true };
    }

    return Object.fromEntries(selected.map((name) => [name, true]));
}

export function relationDisplayValue(value: unknown) {
    if (!value || typeof value !== "object") return null;
    const relation = value as Record<string, unknown>;

    const ad = typeof relation.ad === "string" ? relation.ad.trim() : "";
    const soyad = typeof relation.soyad === "string" ? relation.soyad.trim() : "";
    const adSoyad = `${ad} ${soyad}`.trim();
    if (adSoyad) return adSoyad;
    if (ad) return ad;

    const plaka = typeof relation.plaka === "string" ? relation.plaka.trim() : "";
    const saseNo = typeof relation.saseNo === "string" ? relation.saseNo.trim() : "";
    if (plaka && saseNo) return `${plaka} / ${saseNo}`;
    if (plaka) return plaka;
    if (saseNo) return saseNo;

    if (typeof relation.ad === "string" && relation.ad.trim()) return relation.ad.trim();
    if (typeof relation.eposta === "string" && relation.eposta.trim()) return relation.eposta.trim();
    return null;
}

export function getForeignKeyBaseName(fieldName: string) {
    return fieldName.endsWith("Id") ? fieldName.slice(0, -2) : fieldName;
}

export function getExportColumnKeyForRelationId(fieldName: string, usedKeys: Set<string>) {
    const base = getForeignKeyBaseName(fieldName);
    const candidates = [base, `${base}Adi`, `${base}Bilgi`];

    for (const candidate of candidates) {
        if (!usedKeys.has(candidate)) return candidate;
    }

    let suffix = 2;
    while (usedKeys.has(`${base}${suffix}`)) {
        suffix += 1;
    }
    return `${base}${suffix}`;
}

export function buildExportColumns(
    fields: PrismaField[],
    relationFieldByForeignKey: Map<string, PrismaField>,
    modelName?: string
) {
    const exportColumns: ExportColumn[] = [];
    const usedKeys = new Set<string>();

    for (const field of fields) {
        if (shouldHideInternalField(field.name)) {
            if (field.name.endsWith("Id")) {
                const relationField = relationFieldByForeignKey.get(field.name);
                if (!relationField) continue;
                const key =
                    modelName === "Arac" && field.name === "sirketId" && !usedKeys.has("ruhsatSahibi")
                        ? "ruhsatSahibi"
                        : modelName === "Arac" && field.name === "disFirmaId" && !usedKeys.has("disFirma")
                            ? "disFirma"
                        : getExportColumnKeyForRelationId(field.name, usedKeys);
                usedKeys.add(key);
                exportColumns.push({
                    key,
                    type: "relationLookup",
                    relationFieldName: relationField.name,
                    relationModelName: relationField.type,
                    foreignKeyFieldName: field.name,
                });
            }
            continue;
        }

        usedKeys.add(field.name);
        exportColumns.push({
            key: field.name,
            type: "scalar",
            fieldName: field.name,
        });
    }

    return exportColumns;
}

export function getRelationImportHeaderAliases(modelName: string, foreignKeyFieldName: string) {
    if (modelName === "arac" && foreignKeyFieldName === "sirketId") {
        return [
            "Ruhsat Sahibi",
            "Ruhsat Sahibi Firma",
            "sirket",
            "bagliSirket",
            "operasyonFirma",
            "operasyonFirmasi",
            "ruhsatSahibi",
            "ruhsatSahibiFirma",
            "ruhsatSahibiFirmasi",
        ];
    }
    if (modelName === "arac" && foreignKeyFieldName === "disFirmaId") {
        return [
            "disFirma",
            "Dış Firma",
            "Dis Firma",
            "Dış Firma (Taşeron / Kiralık)",
            "Dis Firma (Taseron / Kiralik)",
            "Kiralık Firma",
            "Kiralik Firma",
            "Taşeron Firma",
            "Taseron Firma",
            "Araç Sahibi Dış Firma",
            "Arac Sahibi Dis Firma",
        ];
    }
    if (modelName === "yakit" && foreignKeyFieldName === "sirketId") {
        return [
            "Bağlı Şirket",
            "Bagli Sirket",
            "Şirket",
            "Sirket",
            "Kullanıcı Firma",
            "Kullanici Firma",
            "Çalıştığı Kurum",
            "Calistigi Kurum",
            "bagliSirket",
            "calistigiKurum",
        ];
    }
    if (modelName === "kullanici" && foreignKeyFieldName === "sirketId") {
        return [
            "Çalıştığı Firma",
            "Calistigi Firma",
            "Bağlı Şirket",
            "Bagli Sirket",
            "Şirket",
            "Sirket",
            "sirket",
            "bagliSirket",
        ];
    }
    return [];
}

export function toExportCell(value: unknown) {
    if (value === undefined) return null;
    if (value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "bigint") return value.toString();
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        return Buffer.from(value).toString("base64");
    }
    if (typeof value === "object") {
        const serializable = typeof (value as { toJSON?: () => unknown }).toJSON === "function"
            ? (value as { toJSON: () => unknown }).toJSON()
            : value;
        if (
            serializable === null ||
            typeof serializable === "string" ||
            typeof serializable === "number" ||
            typeof serializable === "boolean"
        ) {
            return serializable;
        }
        return JSON.stringify(serializable);
    }
    return value;
}

export function excelDateToJSDate(value: number) {
    const excelEpochUtc = Date.UTC(1899, 11, 30);
    return new Date(excelEpochUtc + Math.round(value * 86400 * 1000));
}

export function parseBoolean(value: unknown) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "evet", "yes"].includes(normalized)) return true;
        if (["false", "0", "hayir", "hayır", "no"].includes(normalized)) return false;
    }
    throw new Error(`Boolean deger parse edilemedi: ${String(value)}`);
}

export function normalizeCell(value: unknown) {
    if (value === undefined || value === null) return null;
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed;
    }
    return value;
}

export function normalizeTextToken(value: string) {
    return value
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/ı/g, "i")
        .replace(/İ/g, "i")
        .replace(/ş/g, "s")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c");
}

export function isNullishCellValue(value: unknown) {
    if (typeof value !== "string") return false;
    return NULLISH_CELL_TOKENS.has(normalizeTextToken(value));
}

export function parseNumericCellValue(value: unknown) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== "string") {
        return null;
    }

    const compact = value
        .trim()
        .replace(/\s+/g, "")
        .replace(/₺/g, "")
        .replace(/TL/gi, "")
        .replace(/\$/g, "");

    if (!compact) return null;

    const lastDot = compact.lastIndexOf(".");
    const lastComma = compact.lastIndexOf(",");
    let normalized = compact;

    if (lastDot >= 0 && lastComma >= 0) {
        if (lastComma > lastDot) {
            normalized = compact.replace(/\./g, "").replace(",", ".");
        } else {
            normalized = compact.replace(/,/g, "");
        }
    } else if (lastComma >= 0) {
        const commaCount = (compact.match(/,/g) || []).length;
        if (commaCount > 1) {
            normalized = compact.replace(/,/g, "");
        } else {
            const [left = "", right = ""] = compact.split(",");
            if (/^\d{3}$/.test(right)) {
                normalized = `${left}${right}`;
            } else {
                normalized = `${left}.${right}`;
            }
        }
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

export function hasAnyNonEmptyCell(record: Record<string, unknown>) {
    return Object.values(record).some((value) => normalizeCell(value) !== null);
}

export function getEnumValueMap() {
    const map = new Map<string, Set<string>>();
    const dmmfEnums = (Prisma as any).dmmf?.datamodel?.enums || [];
    for (const enumType of dmmfEnums) {
        map.set(enumType.name, new Set(enumType.values.map((v: any) => v.name)));
    }

    for (const [enumName, enumObject] of Object.entries($Enums || {})) {
        if (!enumObject || typeof enumObject !== "object") continue;
        const values = Object.values(enumObject)
            .map((value) => String(value))
            .filter((value) => value.trim().length > 0);

        if (values.length > 0) {
            map.set(enumName, new Set(values));
        }
    }
    return map;
}

const ENUM_DB_MAPPINGS: Record<string, Record<string, string>> = {
    iller: {
        SANLIURFA: "ŞANLIURFA",
        ISTANBUL: "İSTANBUL",
        DIGER: "DİĞER",
    },
};

export function getDatabaseEnumValue(enumName: string, internalValue: string | null | undefined): string | null {
    if (internalValue === null || internalValue === undefined) return null;
    
    // Check manual mappings first (reliable fallback)
    if (ENUM_DB_MAPPINGS[enumName]?.[internalValue]) {
        return ENUM_DB_MAPPINGS[enumName][internalValue];
    }

    try {
        const dmmfEnums = (Prisma as any).dmmf?.datamodel?.enums || [];
        const enumDef = dmmfEnums.find((e: any) => e.name === enumName);
        if (!enumDef) return internalValue;

        const valueDef = enumDef.values.find((v: any) => v.name === internalValue);
        return valueDef?.dbName || internalValue;
    } catch (error) {
        // We've already checked manual mappings, so just return internalValue
        return internalValue;
    }
}

export function normalizeEnumText(value: string) {
    return value
        .trim()
        .toLocaleUpperCase("tr-TR")
        .replace(/İ/g, "I")
        .replace(/İ/g, "I")
        .replace(/Ş/g, "S")
        .replace(/Ğ/g, "G")
        .replace(/Ü/g, "U")
        .replace(/Ö/g, "O")
        .replace(/Ç/g, "C")
        .replace(/\s+/g, "_")
        .replace(/-/g, "_")
        .replace(/[^A-Z0-9_]/g, "")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
}

export function resolveEnumAlias(enumName: string, value: string) {
    const aliasMap = ENUM_INPUT_ALIASES[enumName];
    if (!aliasMap) return null;

    const normalizedInput = normalizeEnumText(value);
    for (const [alias, canonicalValue] of Object.entries(aliasMap)) {
        if (normalizeEnumText(alias) === normalizedInput) {
            return canonicalValue;
        }
    }

    return null;
}

export function coerceValue(
    field: PrismaField,
    rawValue: unknown,
    enumMap: ReturnType<typeof getEnumValueMap>
) {
    const value = normalizeCell(rawValue);
    if (value === null) return null;
    const valueIsNullish = isNullishCellValue(value);

    if (field.kind === "enum") {
        if (valueIsNullish) return null;
        const enumValues = enumMap.get(field.type);
        const strValue = String(value).trim();
        if (enumValues?.has(strValue)) {
            return strValue;
        }

        const aliasMatch = resolveEnumAlias(field.type, strValue);
        if (aliasMatch && enumValues?.has(aliasMatch)) {
            return aliasMatch;
        }

        const normalizedInput = normalizeEnumText(strValue);
        const matchedValue = enumValues
            ? [...enumValues].find((enumValue) => normalizeEnumText(enumValue) === normalizedInput)
            : null;

        if (!matchedValue) {
            throw new Error(`Enum degeri gecersiz (${field.name}): ${strValue}`);
        }
        return matchedValue;
    }

    switch (field.type) {
        case "String":
            return String(value);
        case "Int": {
            if (valueIsNullish) return null;
            const parsed = parseNumericCellValue(value);
            if (parsed === null || !Number.isFinite(parsed)) {
                throw new Error(`Int parse edilemedi (${field.name}): ${String(value)}`);
            }
            return Math.trunc(parsed);
        }
        case "BigInt": {
            if (valueIsNullish) return null;
            try {
                return BigInt(String(value));
            } catch {
                throw new Error(`BigInt parse edilemedi (${field.name}): ${String(value)}`);
            }
        }
        case "Decimal": {
            if (valueIsNullish) return null;
            try {
                return new Prisma.Decimal(String(value));
            } catch {
                throw new Error(`Decimal parse edilemedi (${field.name}): ${String(value)}`);
            }
        }
        case "Float": {
            if (valueIsNullish) return null;
            const parsed = parseNumericCellValue(value);
            if (parsed === null || !Number.isFinite(parsed)) {
                throw new Error(`Sayi parse edilemedi (${field.name}): ${String(value)}`);
            }
            return parsed;
        }
        case "Bytes":
            if (typeof value === "string") {
                return Buffer.from(value, "base64");
            }
            if (value instanceof Uint8Array) {
                return Buffer.from(value);
            }
            throw new Error(`Bytes parse edilemedi (${field.name}): ${String(value)}`);
        case "Boolean":
            if (valueIsNullish) return null;
            return parseBoolean(value);
        case "DateTime": {
            if (valueIsNullish) return null;
            if (value instanceof Date && !Number.isNaN(value.getTime())) {
                return value;
            }
            if (typeof value === "number") {
                const dt = excelDateToJSDate(value);
                if (Number.isNaN(dt.getTime())) throw new Error(`Tarih parse edilemedi (${field.name}).`);
                return dt;
            }
            const parsed = new Date(String(value));
            if (Number.isNaN(parsed.getTime())) throw new Error(`Tarih parse edilemedi (${field.name}): ${String(value)}`);
            return parsed;
        }
        case "Json":
            if (valueIsNullish) return null;
            if (typeof value === "string") {
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            }
            return value;
        default:
            return value;
    }
}

export function getWhereUnique(
    fields: PrismaField[],
    parsedRow: Record<string, unknown>,
    modelName?: string
) {
    if (modelName === "arac") {
        const plakaValue = parsedRow.plaka;
        if (plakaValue !== null && plakaValue !== undefined && plakaValue !== "") {
            return { where: { plaka: plakaValue } as WhereData, uniqueFieldName: "plaka" };
        }
    }

    const idField = fields.find((field) => field.isId);
    if (idField) {
        const idValue = parsedRow[idField.name];
        if (idValue !== null && idValue !== undefined && idValue !== "") {
            return { where: { [idField.name]: idValue } as WhereData, uniqueFieldName: idField.name };
        }
    }

    const uniqueFields = fields.filter((field) => field.isUnique && !field.isId);
    for (const uniqueField of uniqueFields) {
        const uniqueValue = parsedRow[uniqueField.name];
        if (uniqueValue !== null && uniqueValue !== undefined && uniqueValue !== "") {
            return { where: { [uniqueField.name]: uniqueValue } as WhereData, uniqueFieldName: uniqueField.name };
        }
    }

    return null;
}

export function validateRequiredFields(fields: PrismaField[], parsedRow: Record<string, unknown>, modelName?: string) {
    for (const field of fields) {
        if (field.isUpdatedAt) continue;
        if (!field.isRequired) continue;
        if (field.hasDefaultValue) continue;
        if (parsedRow[field.name] === null || parsedRow[field.name] === undefined || parsedRow[field.name] === "") {
            // Some business logic field specific overrides
            if (modelName === "Yakit" && field.name === "tutar") continue;
            if (modelName === "Muayene" && field.name === "muayeneTarihi") continue;
            if (modelName === "Bakim" && field.name === "yapilanKm") continue;
            
            throw new Error(`Zorunlu alan bos birakilamaz: ${field.name}`);
        }
    }
}

export function buildCreateData(fields: PrismaField[], parsedRow: Record<string, unknown>) {
    const data: Record<string, unknown> = {};

    for (const field of fields) {
        if (field.isUpdatedAt) continue;

        const value = parsedRow[field.name];
        if (value === undefined) {
            continue;
        }
        if (value === null && (field.hasDefaultValue || field.isId)) {
            continue;
        }

        data[field.name] = value;
    }

    return data;
}

export function buildUpdateData(
    fields: PrismaField[],
    parsedRow: Record<string, unknown>,
    uniqueFieldName?: string
) {
    const data: Record<string, unknown> = {};

    for (const field of fields) {
        if (field.isId || field.isUpdatedAt || field.name === uniqueFieldName) continue;
        const value = parsedRow[field.name];
        if (value === undefined) continue;
        if (value === null && field.hasDefaultValue) continue;
        data[field.name] = value;
    }

    return data;
}

export function applyYakitRelationWritesForCreate(data: Record<string, unknown>) {
    const nextData = { ...data };
    const aracId = typeof nextData.aracId === "string" ? nextData.aracId.trim() : "";
    const soforId = typeof nextData.soforId === "string" ? nextData.soforId.trim() : "";

    delete nextData.aracId;
    delete nextData.soforId;

    if (aracId) {
        nextData.arac = { connect: { id: aracId } };
    }
    if (soforId) {
        nextData.sofor = { connect: { id: soforId } };
    }

    return nextData;
}

export function applyYakitRelationWritesForUpdate(
    data: Record<string, unknown>,
    parsedRow: Record<string, unknown>
) {
    const nextData = { ...data };
    const hasAracValue = Object.prototype.hasOwnProperty.call(parsedRow, "aracId");
    const hasSoforValue = Object.prototype.hasOwnProperty.call(parsedRow, "soforId");
    const aracId = typeof parsedRow.aracId === "string" ? parsedRow.aracId.trim() : "";
    const soforId = typeof parsedRow.soforId === "string" ? parsedRow.soforId.trim() : "";

    delete nextData.aracId;
    delete nextData.soforId;

    if (hasAracValue && aracId) {
        nextData.arac = { connect: { id: aracId } };
    }

    if (hasSoforValue) {
        nextData.sofor = soforId ? { connect: { id: soforId } } : { disconnect: true };
    }

    return nextData;
}

export async function createAracWithoutPlakaRaw(tx: unknown, data: Record<string, unknown>) {
    const txRaw = tx as { $executeRaw?: (...args: unknown[]) => Promise<unknown> };
    if (typeof txRaw.$executeRaw !== "function") {
        throw new Error("Plakasiz arac importu icin SQL baglami bulunamadi.");
    }

    const modelMeta = getModelMeta("arac");
    const fieldsByName = modelMeta ? new Map(modelMeta.fields.map(f => [f.name, f])) : null;

    const entries = Object.entries(data).filter(([key, value]) => {
        if (!ARAC_IMPORT_ALLOWED_COLUMNS.has(key)) return false;
        if (value === undefined) return false;
        return true;
    }).map(([key, value]) => {
        // Handle enum mapping for raw SQL
        const field = fieldsByName?.get(key);
        if (field?.kind === "enum" && typeof value === "string") {
            const dbValue = getDatabaseEnumValue(field.type, value);
            return [key, dbValue];
        }
        return [key, value];
    });

    if (!entries.some(([key]) => key === "id")) {
        entries.push(["id", randomUUID()]);
    }
    if (!entries.some(([key]) => key === "plaka")) {
        entries.push(["plaka", null]);
    }

    const columnsSql = Prisma.join(entries.map(([key]) => Prisma.raw(`"${key}"`)));
    const valuesSql = Prisma.join(entries.map(([, value]) => (value === null ? Prisma.sql`NULL` : Prisma.sql`${value}`)));

    await txRaw.$executeRaw(
        Prisma.sql`INSERT INTO "Arac" (${columnsSql}) VALUES (${valuesSql})`
    );
}

export async function getExistingTableColumns(db: unknown, tableName: string) {
    const queryRunner = db as {
        $queryRaw?: <T = unknown>(query: unknown) => Promise<T>;
    };
    if (typeof queryRunner?.$queryRaw !== "function") {
        return null;
    }

    try {
        const rows = (await queryRunner.$queryRaw<Array<{ column_name: string }>>(
            Prisma.sql`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND LOWER(table_name) = LOWER(${tableName})
            `
        )) as Array<{ column_name: string }>;

        return new Set(
            rows
                .map((row) => (typeof row?.column_name === "string" ? row.column_name.trim() : ""))
                .filter((name) => name.length > 0)
        );
    } catch (error) {
        console.warn(`${tableName} tablo kolonlari okunamadi, import kolon uyumluluk fallbacki atlandi.`, error);
        return null;
    }
}

export function pruneDataByExistingColumns(data: Record<string, unknown>, columns: Set<string> | null) {
    if (!columns || columns.size === 0) return data;
    const pruned = { ...data };
    for (const key of Object.keys(pruned)) {
        if (!columns.has(key)) {
            delete pruned[key];
        }
    }
    return pruned;
}

export function buildRequiredImportColumnGroups(fields: PrismaField[], exportColumns: ExportColumn[], modelName?: string) {
    const relationColumnByForeignKey = new Map<string, string>();
    for (const column of exportColumns) {
        if (column.type === "relationLookup") {
            relationColumnByForeignKey.set(column.foreignKeyFieldName, column.key);
        }
    }

    const requiredGroups: Array<{ fieldName: string; candidates: string[] }> = [];
    for (const field of fields) {
        if (field.isUpdatedAt) continue;
        if (!field.isRequired || field.hasDefaultValue) continue;
        if (modelName === "Yakit" && field.name === "tutar") continue;
        if (modelName === "Muayene" && field.name === "muayeneTarihi") continue;
        if (modelName === "Bakim" && field.name === "yapilanKm") continue;

        if (shouldHideInternalField(field.name)) {
            if (field.name.endsWith("Id")) {
                const relationColumn = relationColumnByForeignKey.get(field.name);
                if (relationColumn) {
                    requiredGroups.push({
                        fieldName: field.name,
                        candidates: [relationColumn, field.name],
                    });
                }
            }
            continue;
        }

        requiredGroups.push({
            fieldName: field.name,
            candidates: [field.name],
        });
    }

    return requiredGroups;
}

export function normalizeLookupString(value: unknown) {
    const normalized = normalizeCell(value);
    if (normalized === null) return null;
    if (isNullishCellValue(normalized)) return null;
    return String(normalized).trim();
}

function isKiralikImportText(value: unknown) {
    const text = normalizeLookupString(value);
    if (!text) return false;
    return isKiralikSirketName(text) || normalizeTextToken(text) === "kiralik";
}

function inferDisFirmaTuruFromText(value: unknown): "KIRALIK" | "TASERON" | null {
    const text = normalizeLookupString(value);
    if (!text) return null;
    const normalized = normalizeTextToken(text);
    if (normalized.includes("kiralik")) return "KIRALIK";
    if (normalized.includes("taseron")) return "TASERON";
    return null;
}

function normalizeDisFirmaLookupName(value: unknown) {
    const text = normalizeLookupString(value);
    if (!text) return null;
    return text
        .replace(/\s*\((kiralık|kiralik|taşeron|taseron)\)\s*$/i, "")
        .trim() || null;
}

async function findSirketIdByNameForImport(tx: unknown, value: unknown) {
    const name = normalizeLookupString(value);
    if (!name) return null;

    const sirket = await (getModelDelegate(tx, "sirket") as any)?.findMany?.({
        where: { ad: { equals: name, mode: "insensitive" } },
        select: { id: true },
        take: 1,
        orderBy: { id: "asc" },
    });

    const id = Array.isArray(sirket) ? normalizeLookupString(sirket[0]?.id) : null;
    return id || null;
}

async function findSirketNameByIdForImport(tx: unknown, value: unknown) {
    const id = normalizeLookupString(value);
    if (!id) return null;

    const sirketRows = await (getModelDelegate(tx, "sirket") as any)?.findMany?.({
        where: { id },
        select: { ad: true },
        take: 1,
    });

    const ad = Array.isArray(sirketRows) ? normalizeLookupString(sirketRows[0]?.ad) : null;
    return ad || null;
}

async function ensureKiralikSirketIdForImport(tx: unknown) {
    const existingId = await findSirketIdByNameForImport(tx, KIRALIK_SIRKET_ADI);
    if (existingId) return existingId;

    const delegate = getModelDelegate(tx, "sirket");
    if (!delegate?.create) return null;

    const created = await delegate.create({
        data: { ad: KIRALIK_SIRKET_ADI },
        select: { id: true },
    }) as { id?: string } | null;
    return normalizeLookupString(created?.id);
}

async function resolveDisFirmaIdByNameForImport(
    tx: unknown,
    value: unknown,
    preferredTur?: "KIRALIK" | "TASERON" | null,
    createIfMissing = false
) {
    const name = normalizeDisFirmaLookupName(value);
    if (!name) return null;

    const delegate = getModelDelegate(tx, "disFirma");
    if (!delegate?.findMany) return null;

    const inferredTur = inferDisFirmaTuruFromText(value);
    const targetTur = preferredTur || inferredTur || null;
    const normalizedName = normalizeHeaderToken(name);

    const findCandidates = async (tur?: "KIRALIK" | "TASERON" | null) => {
        const rows = await delegate.findMany?.({
            where: {
                ...(tur ? { tur } : {}),
            },
            select: { id: true, ad: true, tur: true } as Record<string, boolean>,
            orderBy: { id: "asc" },
            take: 1000,
        });
        return (rows || []).filter((row) => normalizeHeaderToken(String(row.ad || "")) === normalizedName);
    };

    const preferredMatches = targetTur ? await findCandidates(targetTur) : [];
    if (preferredMatches.length > 0) {
        return normalizeLookupString(preferredMatches[0]?.id);
    }

    const allMatches = targetTur ? [] : await findCandidates(null);
    if (allMatches.length === 1) {
        return normalizeLookupString(allMatches[0]?.id);
    }

    if (allMatches.length > 1) {
        const kiralikMatch = allMatches.find((row) => row.tur === "KIRALIK");
        if (kiralikMatch) return normalizeLookupString(kiralikMatch.id);
        return normalizeLookupString(allMatches[0]?.id);
    }

    if (!createIfMissing || !delegate.create) return null;

    const created = await delegate.create({
        data: {
            ad: name,
            tur: targetTur || "KIRALIK",
        },
        select: { id: true },
    }) as { id?: string } | null;
    return normalizeLookupString(created?.id);
}

async function findAracIdByKullaniciIdForImport(tx: unknown, kullaniciIdValue: unknown) {
    const kullaniciId = normalizeLookupString(kullaniciIdValue);
    if (!kullaniciId) return null;

    const rows = await (getModelDelegate(tx, "arac") as any)?.findMany?.({
        where: { kullaniciId },
        select: { id: true },
        take: 1,
        orderBy: { id: "asc" },
    });
    const id = Array.isArray(rows) ? normalizeLookupString(rows[0]?.id) : null;
    return id || null;
}

async function resolveYakitUsageSirketIdForImport(tx: unknown, aracIdValue: unknown) {
    const aracId = normalizeLookupString(aracIdValue);
    if (!aracId) return null;

    const aracRows = await (getModelDelegate(tx, "arac") as any)?.findMany?.({
        where: { id: aracId },
        select: { id: true, calistigiKurum: true, kullaniciId: true },
        take: 1,
    });
    const arac = Array.isArray(aracRows) ? aracRows[0] : null;
    if (!arac) return null;

    const aracKurumSirketId = await findSirketIdByNameForImport(tx, arac.calistigiKurum);
    if (aracKurumSirketId) return aracKurumSirketId;

    const zimmetRows = await (getModelDelegate(tx, "kullaniciZimmet") as any)?.findMany?.({
        where: { aracId, bitis: null },
        orderBy: { baslangic: "desc" },
        select: { kullaniciId: true },
        take: 1,
    });
    const aktifKullaniciId = normalizeLookupString(Array.isArray(zimmetRows) ? zimmetRows[0]?.kullaniciId : null) ||
        normalizeLookupString(arac.kullaniciId);
    if (!aktifKullaniciId) return null;

    const kullaniciRows = await (getModelDelegate(tx, "kullanici") as any)?.findMany?.({
        where: { id: aktifKullaniciId, deletedAt: null },
        select: { sirketId: true, calistigiKurum: true },
        take: 1,
    });
    const kullanici = Array.isArray(kullaniciRows) ? kullaniciRows[0] : null;
    const kullaniciSirketId = normalizeLookupString(kullanici?.sirketId);
    if (kullaniciSirketId) return kullaniciSirketId;

    return findSirketIdByNameForImport(tx, kullanici?.calistigiKurum);
}

export function normalizeAracPlaka(value: unknown) {
    const normalized = normalizeCell(value);
    if (normalized === null) return null;
    if (isNullishCellValue(normalized)) return null;
    const text = String(normalized)
        .replace(/[^0-9a-zA-ZğüşiöçıİĞÜŞÖÇ]/g, "")
        .toLocaleUpperCase("tr-TR");
    return text || null;
}

export function normalizeAracSaseNo(value: unknown) {
    const normalized = normalizeCell(value);
    if (normalized === null) return null;
    if (isNullishCellValue(normalized)) return null;
    const text = String(normalized).replace(/\s+/g, "").toLocaleUpperCase("tr-TR");
    return text || null;
}

export function normalizeAracMotorNo(value: unknown) {
    const normalized = normalizeCell(value);
    if (normalized === null) return null;
    if (isNullishCellValue(normalized)) return null;
    const text = String(normalized).replace(/\s+/g, "").toLocaleUpperCase("tr-TR");
    return text || null;
}

export async function findExistingNoPlateAracId(tx: unknown, createData: Record<string, unknown>) {
    const txQuery = tx as { $queryRaw?: (...args: unknown[]) => Promise<unknown> };
    if (typeof txQuery.$queryRaw !== "function") {
        return null;
    }

    const normalizedSaseNo = normalizeAracSaseNo(createData.saseNo);
    if (normalizedSaseNo) {
        const rows = (await txQuery.$queryRaw(
            Prisma.sql`
                SELECT "id"
                FROM "Arac"
                WHERE ("plaka" IS NULL OR "plaka" = '-')
                  AND "saseNo" = ${normalizedSaseNo}
                ORDER BY "id" ASC
                LIMIT 1
            `
        )) as Array<{ id: string }>;
        const id = rows?.[0]?.id;
        return typeof id === "string" && id.trim().length > 0 ? id : null;
    }

    const marka = typeof createData.marka === "string" ? createData.marka.trim() : "";
    const model = typeof createData.model === "string" ? createData.model.trim() : "";
    const yil = typeof createData.yil === "number" && Number.isFinite(createData.yil) ? createData.yil : null;
    if (!marka || !model || yil === null) {
        return null;
    }

    const sirketIdRaw = "sirketId" in createData ? createData.sirketId : undefined;
    const sirketId = typeof sirketIdRaw === "string" && sirketIdRaw.trim().length > 0 ? sirketIdRaw : null;

    const rows = sirketId
        ? ((await txQuery.$queryRaw(
            Prisma.sql`
                SELECT "id"
                FROM "Arac"
                WHERE ("plaka" IS NULL OR "plaka" = '-')
                  AND "marka" = ${marka}
                  AND "model" = ${model}
                  AND "yil" = ${yil}
                  AND "sirketId" = ${sirketId}
                ORDER BY "id" ASC
                LIMIT 1
            `
        )) as Array<{ id: string }>)
        : ((await txQuery.$queryRaw(
            Prisma.sql`
                SELECT "id"
                FROM "Arac"
                WHERE ("plaka" IS NULL OR "plaka" = '-')
                  AND "marka" = ${marka}
                  AND "model" = ${model}
                  AND "yil" = ${yil}
                  AND "sirketId" IS NULL
                ORDER BY "id" ASC
                LIMIT 1
            `
        )) as Array<{ id: string }>);

    const id = rows?.[0]?.id;
    return typeof id === "string" && id.trim().length > 0 ? id : null;
}

export async function findExistingBusinessRecord(tx: unknown, modelName: string, parsedRow: Record<string, unknown>) {
    const delegate = getModelDelegate(tx, lowerFirst(modelName));
    if (!delegate?.findMany) return null;

    const where: WhereData = {};

    if (modelName === "kullanici") {
        if (!parsedRow.ad || !parsedRow.soyad) return null;
        
        // Match by TC No first if available (most reliable)
        if (parsedRow.tcNo) {
            const byTcNo = await delegate.findMany({
                where: { tcNo: String(parsedRow.tcNo).trim(), deletedAt: null },
                select: { id: true },
                take: 1
            });
            if (byTcNo.length > 0) return byTcNo[0].id;
        }

        const candidates = await delegate.findMany({
            where: {
                ad: { equals: String(parsedRow.ad).trim(), mode: "insensitive" },
                soyad: { equals: String(parsedRow.soyad).trim(), mode: "insensitive" },
                deletedAt: null
            },
            select: { id: true, tcNo: true },
            take: 5
        });

        if (candidates.length === 1) return candidates[0].id;
        
        // If multiple name matches, try to disambiguate with TC No from Excel
        if (candidates.length > 1 && parsedRow.tcNo) {
            const targetTc = String(parsedRow.tcNo).trim();
            const exactMatch = candidates.find(c => c.tcNo === targetTc);
            if (exactMatch) return exactMatch.id;
        }

        return null;
    }

    if (modelName === "disFirma") {
        if (!parsedRow.ad || !parsedRow.tur) return null;
        const existing = await delegate.findMany({
            where: {
                ad: { equals: String(parsedRow.ad).trim(), mode: "insensitive" },
                tur: parsedRow.tur as any,
            },
            select: { id: true },
            take: 1,
        });
        return existing.length > 0 ? existing[0].id : null;
    }

    if (modelName === "yakit") {
        if (!parsedRow.aracId || !parsedRow.tarih || parsedRow.litre === undefined) return null;
        
        // Match by day instead of exact second for better Excel compatibility
        const targetDate = parsedRow.tarih as Date;
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const candidates = await delegate.findMany({
            where: {
                aracId: parsedRow.aracId as string,
                tarih: {
                    gte: startOfDay,
                    lte: endOfDay
                },
                // Use a small range for liters to handle Excel floating point issues
                litre: {
                    gte: Number(parsedRow.litre) - 0.01,
                    lte: Number(parsedRow.litre) + 0.01
                }
            },
            select: { id: true, km: true, endeks: true }
        });

        if (candidates.length === 0) return null;
        
        // If we have KM or Endeks, use them for a tighter match
        if (parsedRow.km !== undefined || parsedRow.endeks !== undefined) {
            const matches = candidates.filter((c: any) => {
                const kmMatch = parsedRow.km === undefined || c.km === parsedRow.km;
                const endeksMatch = parsedRow.endeks === undefined || c.endeks === parsedRow.endeks;
                return kmMatch && endeksMatch;
            });
            if (matches.length > 0) return matches[0].id;
        }

        return candidates[0].id;
    } else if (modelName === "bakim") {
        if (!parsedRow.aracId || !parsedRow.bakimTarihi || parsedRow.yapilanKm === undefined) return null;
        const targetDate = parsedRow.bakimTarihi as Date;
        const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);
        
        const existing = await delegate.findMany({
            where: {
                aracId: parsedRow.aracId as string,
                bakimTarihi: { gte: startOfDay, lte: endOfDay },
                yapilanKm: Number(parsedRow.yapilanKm)
            },
            select: { id: true }
        });
        return existing.length > 0 ? existing[0].id : null;
    } else if (modelName === "muayene") {
        if (!parsedRow.aracId || !parsedRow.muayeneTarihi) return null;
        const targetDate = parsedRow.muayeneTarihi as Date;
        const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

        const existing = await delegate.findMany({
            where: {
                aracId: parsedRow.aracId as string,
                muayeneTarihi: { gte: startOfDay, lte: endOfDay }
            },
            select: { id: true }
        });
        return existing.length > 0 ? existing[0].id : null;
    } else if (modelName === "ceza") {
        if (!parsedRow.aracId || !parsedRow.tarih || parsedRow.tutar === undefined) return null;
        const targetDate = parsedRow.tarih as Date;
        const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

        const existing = await delegate.findMany({
            where: {
                aracId: parsedRow.aracId as string,
                tarih: { gte: startOfDay, lte: endOfDay },
                tutar: Number(parsedRow.tutar)
            },
            select: { id: true }
        });
        return existing.length > 0 ? existing[0].id : null;
    } else if (modelName === "masraf") {
        if (!parsedRow.aracId || !parsedRow.tarih || parsedRow.tutar === undefined || !parsedRow.tur) return null;
        const targetDate = parsedRow.tarih as Date;
        const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

        const existing = await delegate.findMany({
            where: {
                aracId: parsedRow.aracId as string,
                tarih: { gte: startOfDay, lte: endOfDay },
                tutar: Number(parsedRow.tutar),
                tur: parsedRow.tur as any
            },
            select: { id: true }
        });
        return existing.length > 0 ? existing[0].id : null;
    } else if (modelName === "hgsYukleme") {
        if (!parsedRow.aracId || !parsedRow.tarih || parsedRow.tutar === undefined) return null;
        const targetDate = parsedRow.tarih as Date;
        const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

        const existing = await delegate.findMany({
            where: {
                aracId: parsedRow.aracId as string,
                tarih: { gte: startOfDay, lte: endOfDay },
                tutar: Number(parsedRow.tutar)
            },
            select: { id: true }
        });
        return existing.length > 0 ? existing[0].id : null;
    } else if (modelName === "trafikSigortasi" || modelName === "kasko") {
        if (!parsedRow.aracId || !parsedRow.policeNo) return null;
        Object.assign(where, {
            aracId: parsedRow.aracId,
            policeNo: String(parsedRow.policeNo)
        });
    } else if (modelName === "kullaniciZimmet") {
        if (!parsedRow.aracId || !parsedRow.kullaniciId || !parsedRow.baslangic) return null;
        const targetDate = parsedRow.baslangic as Date;
        const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

        const existing = await delegate.findMany({
            where: {
                aracId: parsedRow.aracId as string,
                kullaniciId: parsedRow.kullaniciId as string,
                baslangic: { gte: startOfDay, lte: endOfDay }
            },
            select: { id: true }
        });
        return existing.length > 0 ? existing[0].id : null;
    } else {
        return null;
    }

    const matches = await delegate.findMany({
        where,
        select: { id: true },
        take: 1
    });

    return matches?.[0]?.id || null;
}

export function sanitizeAracImportRow(parsedRow: Record<string, unknown>) {
    const nullableToUndefined: Array<keyof typeof parsedRow> = ["guncelKm", "durum", "kategori", "bulunduguIl"];
    for (const key of nullableToUndefined) {
        if (parsedRow[key] === null || parsedRow[key] === "") {
            parsedRow[key] = undefined;
        }
    }

    if (parsedRow.yil === null || parsedRow.yil === undefined || parsedRow.yil === "") {
        parsedRow.yil = new Date().getFullYear();
    }
}

export function buildRelationLookupWheres(modelName: string, rawValue: string) {
    const value = rawValue.trim();
    if (!value) return [];

    const wheres: WhereData[] = [{ id: value }];

    if (modelName === "Arac") {
        const normalizedPlaka = normalizeAracPlaka(value);
        const slashParts = value.split("/").map((part) => part.trim()).filter(Boolean);
        if (slashParts.length >= 2) {
            wheres.push({
                AND: [
                    { plaka: slashParts[0] },
                    { saseNo: slashParts[1] },
                ],
            } as WhereData);
        }
        wheres.push({ plaka: value });
        if (normalizedPlaka && normalizedPlaka !== value) {
            wheres.push({ plaka: normalizedPlaka });
        }
        wheres.push({ saseNo: value });
        return wheres;
    }

    if (modelName === "Kullanici") {
        const personText = value.split(/\s+-\s+/)[0]?.trim() || value;
        const parts = personText.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            const ad = parts[0];
            const soyad = parts.slice(1).join(" ");
            wheres.push({
                AND: [
                    { ad: { equals: ad, mode: "insensitive" } },
                    { soyad: { equals: soyad, mode: "insensitive" } },
                ],
            } as WhereData);
        }
        wheres.push({ eposta: { equals: personText, mode: "insensitive" } });
        wheres.push({ tcNo: { equals: personText, mode: "insensitive" } });
        wheres.push({ ad: { equals: personText, mode: "insensitive" } });
        return wheres;
    }

    if (modelName === "Sirket") {
        wheres.push({ ad: { equals: value, mode: "insensitive" } });
        // Also try partial match if needed, but insensitive equals is safer for now
        return wheres;
    }

    wheres.push({ ad: value });
    wheres.push({ plaka: value });
    wheres.push({ eposta: value });
    return wheres;
}

export async function resolveRelationValueToForeignKey(params: {
    tx: unknown;
    relationModelName: string;
    relationColumnKey: string;
    rawRelationValue: unknown;
    rowIndex: number;
    cache: Map<string, string>;
    allowNotFound?: boolean;
    context?: {
        importModelName?: string;
        foreignKeyFieldName?: string;
        parsedRow?: Record<string, unknown>;
    };
}) {
    const relationText = normalizeLookupString(params.rawRelationValue);
    if (!relationText) return null;

    const scopedAracId =
        params.context?.importModelName === "yakit" && params.context?.foreignKeyFieldName === "soforId"
            ? normalizeLookupString(params.context?.parsedRow?.aracId)
            : null;
    const scopedSirketId =
        params.context?.importModelName === "yakit" && params.context?.foreignKeyFieldName === "soforId"
            ? normalizeLookupString(params.context?.parsedRow?.sirketId)
            : null;
    const cacheKey = `${params.relationModelName}|${relationText}|arac:${scopedAracId || ""}|sirket:${scopedSirketId || ""}`;
    const cached = params.cache.get(cacheKey);
    if (cached) return cached;

    const relationDelegate = getModelDelegate(params.tx, lowerFirst(params.relationModelName));
    if (!relationDelegate?.findMany) {
        throw new Error(`Satir ${params.rowIndex + 2}: ${params.relationColumnKey} icin iliski modeli bulunamadi.`);
    }

    if (params.relationModelName === "DisFirma") {
        const preferredTur = inferDisFirmaTuruFromText(params.rawRelationValue);
        const disFirmaId = await resolveDisFirmaIdByNameForImport(
            params.tx,
            params.rawRelationValue,
            preferredTur,
            params.context?.importModelName === "arac" && Boolean(preferredTur)
        );
        if (disFirmaId) {
            params.cache.set(cacheKey, disFirmaId);
            return disFirmaId;
        }
        if (params.allowNotFound) return null;
        throw new Error(`Satir ${params.rowIndex + 2}: ${params.relationColumnKey} icin dis firma bulunamadi (${relationText}).`);
    }

    const whereCandidates = buildRelationLookupWheres(params.relationModelName, relationText);
    for (const where of whereCandidates) {
        const effectiveWhere =
            params.relationModelName === "Kullanici"
                ? ({ AND: [where as WhereData, { deletedAt: null }] } as WhereData)
                : where;
        const matches = await relationDelegate.findMany({
            where: effectiveWhere,
            select: { id: true },
            take: 2,
            orderBy: { id: "asc" },
        });

        if (matches.length === 1) {
            const id = matches[0]?.id;
            if (typeof id !== "string" || !id.trim()) continue;
            params.cache.set(cacheKey, id);
            return id;
        }

        if (matches.length > 1) {
            const isYakitSoforResolve =
                params.context?.importModelName === "yakit" &&
                params.context?.foreignKeyFieldName === "soforId" &&
                params.relationModelName === "Kullanici";
            if (isYakitSoforResolve) {
                const candidateIds = matches
                    .map((match) => (typeof match?.id === "string" ? match.id.trim() : ""))
                    .filter((id) => id.length > 0);
                const parsedRow = params.context?.parsedRow || {};

                const scopedSirket = normalizeLookupString(parsedRow.sirketId);
                if (candidateIds.length > 1 && scopedSirket) {
                    const companyMatches = await relationDelegate.findMany({
                        where: {
                            AND: [
                                { id: { in: candidateIds } },
                                { sirketId: scopedSirket },
                                { deletedAt: null },
                            ],
                        },
                        select: { id: true },
                        orderBy: { id: "asc" },
                        take: 2,
                    });
                    if (companyMatches.length === 1) {
                        const scopedUserId = normalizeLookupString(companyMatches[0]?.id);
                        if (scopedUserId) {
                            params.cache.set(cacheKey, scopedUserId);
                            return scopedUserId;
                        }
                    }
                }
                const scopedKurum = normalizeLookupString(parsedRow.calistigiKurum);
                if (candidateIds.length > 1 && scopedKurum) {
                    const kurumMatches = await relationDelegate.findMany({
                        where: {
                            AND: [
                                { id: { in: candidateIds } },
                                { calistigiKurum: { equals: scopedKurum, mode: "insensitive" } },
                                { deletedAt: null },
                            ],
                        },
                        select: { id: true },
                        orderBy: { id: "asc" },
                        take: 2,
                    });
                    if (kurumMatches.length === 1) {
                        const kurumUserId = normalizeLookupString(kurumMatches[0]?.id);
                        if (kurumUserId) {
                            params.cache.set(cacheKey, kurumUserId);
                            return kurumUserId;
                        }
                    }
                }

                if (params.allowNotFound) {
                    return null;
                }
            }
            if (params.allowNotFound) {
                return null;
            }
            throw new Error(
                `Satir ${params.rowIndex + 2}: ${params.relationColumnKey} degeri birden fazla kayitla eslesti (${relationText}).`
            );
        }
    }

    if (params.allowNotFound) {
        return null;
    }
    throw new Error(`Satir ${params.rowIndex + 2}: ${params.relationColumnKey} icin eslesen kayit bulunamadi (${relationText}).`);
}

// --- Orchestration Functions ---

export async function exportEntity(entityKey: string, where?: WhereData) {
    const config = getEntityOrNull(entityKey);
    if (!config) throw new Error("Desteklenmeyen export modeli.");
    const profileKey = getExcelProfileKey(config.prismaModel, entityKey);

    const modelMeta = getModelMeta(config.prismaModel);
    if (!modelMeta) throw new Error("Model metadata bulunamadi.");

    const fields = getColumnFields(modelMeta);
    const relationFieldByForeignKey = buildRelationFieldByForeignKeyMap(modelMeta);
    const exportColumns = buildExportColumns(fields, relationFieldByForeignKey, modelMeta.name);
    const columns = exportColumns.map((column) => column.key);

    const modelDelegate = getModelDelegate(prisma, config.prismaModel);
    if (!modelDelegate?.findMany) throw new Error("Model export icin uygun degil.");

    const orderByField = 
        fields.find((field) => field.isId)?.name || 
        exportColumns.find(c => c.type === "scalar")?.key || 
        "id";
    const include = Object.fromEntries(
        [...relationFieldByForeignKey.entries()].map(([, relationField]) => [
            relationField.name,
            { select: buildRelationExportSelect(relationField.type) },
        ])
    );
    
    const rows = await modelDelegate.findMany({
        where: where ? (where as WhereData) : undefined,
        orderBy: orderByField ? { [orderByField]: "asc" } : undefined,
        include: Object.keys(include).length > 0 ? include : undefined,
    });

    const aktifZimmetByAracId = new Map<string, { adSoyad: string | null; sirketAd: string | null }>();
    if (config.prismaModel === "arac") {
        const aracIds = rows.map((row) => (row.id as string)).filter(Boolean);
        if (aracIds.length > 0) {
            const zimmetRows = await prisma.kullaniciZimmet.findMany({
                where: { aracId: { in: aracIds }, bitis: null },
                orderBy: [{ aracId: "asc" }, { baslangic: "desc" }],
                select: {
                    aracId: true,
                    kullanici: {
                        select: {
                            ad: true,
                            soyad: true,
                            sirket: { select: { ad: true } },
                        },
                    },
                },
            });
            for (const row of zimmetRows) {
                if (!row?.aracId || aktifZimmetByAracId.has(row.aracId)) continue;
                const adSoyad = `${row.kullanici?.ad || ""} ${row.kullanici?.soyad || ""}`.trim();
                aktifZimmetByAracId.set(row.aracId, {
                    adSoyad: adSoyad || null,
                    sirketAd: row.kullanici?.sirket?.ad || null
                });
            }
        }
    }

    const yakitSirketNameById = new Map<string, string>();
    if (config.prismaModel === "yakit") {
        const sirketIds = Array.from(new Set(rows.map(r => (r.arac as any)?.sirketId).filter(Boolean))) as string[];
        if (sirketIds.length > 0) {
            const sirkets = await prisma.sirket.findMany({ where: { id: { in: sirketIds } }, select: { id: true, ad: true } });
            for (const s of sirkets) yakitSirketNameById.set(s.id, s.ad);
        }
    }

    const normalizedRows = rows.map((row) => {
        const output: Record<string, unknown> = {};
        for (const column of exportColumns) {
            if (column.type === "scalar") {
                output[column.key] = toExportCell(row[column.fieldName]);
            } else {
                output[column.key] = toExportCell(relationDisplayValue(row[column.relationFieldName]));
            }
        }
        if (config.prismaModel === "arac") {
            const rowId = row.id as string;
            const zimmet = aktifZimmetByAracId.get(rowId);
            const kullaniciObj = row.kullanici as any;
            const kullaniciSirketAd = kullaniciObj?.sirket?.ad;
            const adSoyad = relationDisplayValue(kullaniciObj);
            output.kullanici = toExportCell(adSoyad || zimmet?.adSoyad || null);
            output.calistigiKurum = toExportCell(row.calistigiKurum || kullaniciSirketAd || zimmet?.sirketAd || null);
        }
        if (config.prismaModel === "yakit" || config.prismaModel === "kasko" || config.prismaModel === "trafikSigortasi") {
            const aracObj = row.arac as any;
            const soforObj = row.sofor as any;
            const bagliSirket = aracObj?.sirket?.ad || yakitSirketNameById.get(aracObj?.sirketId) || aracObj?.ruhsatSahibi || null;
            output.arac = toExportCell(aracObj?.plaka || relationDisplayValue(aracObj));
            if (config.prismaModel === "yakit") output.sofor = toExportCell(relationDisplayValue(soforObj));
            output.bagliSirket = toExportCell(bagliSirket);
            output.calistigiKurum = toExportCell(aracObj?.calistigiKurum || soforObj?.calistigiKurum || soforObj?.sirket?.ad || null);
        }
        if (config.prismaModel === "kullanici") {
            const aracObj = row.arac as any;
            output.zimmetliArac = toExportCell(aracObj?.plaka || relationDisplayValue(aracObj));
        }
        if (config.prismaModel === "bakim") {
            const islemYapanFirma = normalizeLookupString(row.islemYapanFirma) || normalizeLookupString(row.servisAdi);
            output.islemYapanFirma = toExportCell(islemYapanFirma);
        }
        return output;
    });

    const internalColumns = config.prismaModel === "arac"
        ? [...columns, "calistigiKurum", "aciklama", "bedel"].filter((v, i, a) => a.indexOf(v) === i)
        : (config.prismaModel === "yakit" || config.prismaModel === "kasko" || config.prismaModel === "trafikSigortasi")
            ? [...columns, "bagliSirket", "calistigiKurum"].filter((v, i, a) => a.indexOf(v) === i)
            : columns;
    
    const finalColumns = applyExportProfile(profileKey, internalColumns);
    const exportRows = normalizedRows.map((row) => {
        const output: Record<string, unknown> = {};
        for (const key of finalColumns) {
            output[getExportHeaderLabel(profileKey, key)] = row[key] ?? null;
        }
        return output;
    });

    return { 
        data: exportRows, 
        sheetName: config.sheetName, 
        headers: finalColumns.map(key => getExportHeaderLabel(profileKey, key)) 
    };
}

export async function importEntity(entityKey: string, records: any[], tx: any, options?: ImportEntityOptions) {
    const config = getEntityOrNull(entityKey);
    if (!config) throw new Error("Desteklenmeyen import modeli.");
    const profileKey = getExcelProfileKey(config.prismaModel, entityKey);
    const importScope = getEntityImportScope(entityKey, options);
    const forcedDisFirmaId = normalizeOptionalId(options?.selectedDisFirmaId);

    const modelMeta = getModelMeta(config.prismaModel);
    if (!modelMeta) throw new Error("Model metadata bulunamadi.");

    const fields = getColumnFields(modelMeta);
    const fieldsByName = new Map(fields.map((field) => [field.name, field]));
    const relationFieldByForeignKey = buildRelationFieldByForeignKeyMap(modelMeta);
    const exportColumns = buildExportColumns(fields, relationFieldByForeignKey, modelMeta.name);
    const scalarImportColumns = exportColumns.filter((c): c is any => c.type === "scalar");
    const relationImportColumns = exportColumns.filter((c): c is any => c.type === "relationLookup");
    const fixedDisFirmaTuru = entityKey === "taseronFirma"
        ? "TASERON"
        : entityKey === "kiralikFirma"
            ? "KIRALIK"
            : importScope.fixedDisFirmaTuru;
    const requiredGroups = buildRequiredImportColumnGroups(fields, exportColumns, modelMeta.name)
        .filter((group) => !(config.prismaModel === "disFirma" && fixedDisFirmaTuru && group.fieldName === "tur"))
        .filter((group) => {
            if (entityKey !== "kiralikArac") return true;
            return !["marka", "model", "yil"].includes(group.fieldName);
        });
    const enumMap = getEnumValueMap();

    const firstRecord = records[0] || {};
    const availableHeaders = new Set(Object.keys(firstRecord).map(h => h.trim()).filter(h => h.length > 0));
    const normalizedHeaderIndex = buildHeaderIndex([...availableHeaders]);

    const missingGroups = requiredGroups.filter((group) => {
        const groupCandidates = group.candidates.flatMap((candidate) => getHeaderCandidates(profileKey, candidate));
        return !findHeaderByCandidates(availableHeaders, normalizedHeaderIndex, groupCandidates);
    });
    
    if (missingGroups.length > 0) {
        throw new Error(`Eksik zorunlu sutun(lar): ${missingGroups.map(g => g.fieldName).join(", ")}`);
    }

    const model = getModelDelegate(tx, config.prismaModel);
    if (!model?.create || !model?.update || !model?.findUnique) throw new Error("Model import islemi desteklenmiyor.");

    let created = 0, updated = 0, skipped = 0;
    const relationCache = new Map<string, string>();
    const disFirmaTurCache = new Map<string, ExternalVendorMode | null>();
    const bakimExistingColumns = config.prismaModel === "bakim" ? await getExistingTableColumns(tx, "Bakim") : null;
    const kmCache = new Map<string, number>();

    for (let index = 0; index < records.length; index++) {
        const record = records[index];
        const parsedRow: Record<string, unknown> = {};
        if (!hasAnyNonEmptyCell(record)) { skipped++; continue; }

        let skipRow = false;
        try {
            for (const column of scalarImportColumns) {
                const field = fieldsByName.get(column.fieldName)!;
                const header = resolveImportHeaderForRecord(availableHeaders, normalizedHeaderIndex, availableHeaders, normalizedHeaderIndex, getHeaderCandidates(profileKey, column.key));
                parsedRow[field.name] = header ? coerceValue(field, record[header], enumMap) : undefined;
            }

            for (const column of relationImportColumns) {
                const field = fieldsByName.get(column.foreignKeyFieldName)!;
                const header = resolveImportHeaderForRecord(availableHeaders, normalizedHeaderIndex, availableHeaders, normalizedHeaderIndex, getHeaderCandidates(profileKey, column.key, getRelationImportHeaderAliases(config.prismaModel, field.name)));
                if (!header) { parsedRow[field.name] = undefined; continue; }
                
                const rawVal = record[header];
                if (rawVal === null) { parsedRow[field.name] = null; continue; }

                const resolved = await resolveRelationValueToForeignKey({
                    tx, relationModelName: column.relationModelName, relationColumnKey: column.key,
                    rawRelationValue: rawVal, rowIndex: index, cache: relationCache, allowNotFound: true,
                    context: { importModelName: config.prismaModel, foreignKeyFieldName: field.name, parsedRow }
                });

                if (resolved === null && field.name === "aracId") { skipRow = true; break; }
                parsedRow[field.name] = coerceValue(field, resolved, enumMap);
            }

            if (skipRow) { skipped++; continue; }

            if (config.prismaModel === "disFirma" && fixedDisFirmaTuru) {
                parsedRow.tur = fixedDisFirmaTuru;
            }

            // Business Logic Specifics (Yakit/Bakim/Arac)
            if (config.prismaModel === "arac") {
                const ruhsatHeader = resolveImportHeaderForRecord(
                    availableHeaders,
                    normalizedHeaderIndex,
                    availableHeaders,
                    normalizedHeaderIndex,
                    getHeaderCandidates(profileKey, "ruhsatSahibi", getRelationImportHeaderAliases(config.prismaModel, "sirketId"))
                );
                const rawRuhsatSahibi = ruhsatHeader ? record[ruhsatHeader] : null;
                const ruhsatKiralikMi = isKiralikImportText(rawRuhsatSahibi);

                if (ruhsatKiralikMi) {
                    parsedRow.sirketId = await ensureKiralikSirketIdForImport(tx);
                }

                const disFirmaHeader = resolveImportHeaderForRecord(
                    availableHeaders,
                    normalizedHeaderIndex,
                    availableHeaders,
                    normalizedHeaderIndex,
                    getHeaderCandidates(profileKey, "disFirma", getRelationImportHeaderAliases(config.prismaModel, "disFirmaId"))
                );
                const rawDisFirma = disFirmaHeader ? record[disFirmaHeader] : null;
                if (!parsedRow.disFirmaId && normalizeDisFirmaLookupName(rawDisFirma)) {
                    parsedRow.disFirmaId = await resolveDisFirmaIdByNameForImport(
                        tx,
                        rawDisFirma,
                        ruhsatKiralikMi ? "KIRALIK" : inferDisFirmaTuruFromText(rawDisFirma),
                        ruhsatKiralikMi
                    );
                }

                if (entityKey === "kiralikArac") {
                    if (!normalizeLookupString(parsedRow.marka)) {
                        parsedRow.marka = "KIRALIK";
                    }
                    if (!normalizeLookupString(parsedRow.model)) {
                        parsedRow.model = "ARAC";
                    }
                    const yilValue = Number(parsedRow.yil);
                    if (!Number.isInteger(yilValue) || yilValue < 1990 || yilValue > new Date().getFullYear() + 1) {
                        parsedRow.yil = new Date().getFullYear();
                    }
                    if (!normalizeLookupString(parsedRow.sirketId)) {
                        throw new Error(`Satir ${index + 2}: Çalıştığı firmamız zorunludur.`);
                    }
                    if (!normalizeLookupString(parsedRow.calistigiKurum)) {
                        parsedRow.calistigiKurum = await findSirketNameByIdForImport(tx, parsedRow.sirketId);
                    }
                }
            }

            if (config.prismaModel === "arac" || config.prismaModel === "kullanici") {
                if (importScope.forceInternal) {
                    parsedRow.disFirmaId = null;
                } else {
                    if (forcedDisFirmaId) {
                        parsedRow.disFirmaId = forcedDisFirmaId;
                    }
                    if (fixedDisFirmaTuru) {
                        if (!parsedRow.disFirmaId) {
                            throw new Error(`Satir ${index + 2}: Dış firma zorunlu. Lütfen dış firma sütununu doldurun veya firma filtresi seçin.`);
                        }
                        const valid = await validateDisFirmaIdForImportScope(
                            tx,
                            parsedRow.disFirmaId,
                            fixedDisFirmaTuru,
                            disFirmaTurCache
                        );
                        if (!valid) {
                            throw new Error(`Satir ${index + 2}: Seçilen dış firma ${fixedDisFirmaTuru.toLocaleLowerCase("tr-TR")} türünde değil.`);
                        }
                    }
                }
            }

            if (config.prismaModel === "yakit") {
                parsedRow.tutar = parsedRow.tutar || 0;
                if (!parsedRow.aracId) { skipped++; continue; }
                parsedRow.sirketId = await resolveYakitUsageSirketIdForImport(tx, parsedRow.aracId);
            }

            if (config.prismaModel === "bakim") {
                if (!parsedRow.aracId) { skipped++; continue; }
                parsedRow.tutar = (parsedRow.tutar as number) || 0;
                const islemYapanFirma = normalizeLookupString(parsedRow.islemYapanFirma) || normalizeLookupString(parsedRow.servisAdi);
                parsedRow.islemYapanFirma = islemYapanFirma || null;
                parsedRow.servisAdi = islemYapanFirma || null;
                parsedRow.kategori = parsedRow.kategori || (parsedRow.arizaSikayet ? "ARIZA" : "PERIYODIK_BAKIM");
                parsedRow.tur = parsedRow.tur || (parsedRow.kategori === "ARIZA" ? "ARIZA" : "PERIYODIK");
                
                if (parsedRow.yapilanKm === undefined || parsedRow.yapilanKm === null) {
                    let km = kmCache.get(parsedRow.aracId as string);
                    if (km === undefined) {
                        const arac = await (getModelDelegate(tx, "arac") as any).findUnique({ where: { id: parsedRow.aracId }, select: { guncelKm: true } });
                        km = arac?.guncelKm || 0;
                    }
                    parsedRow.yapilanKm = km;
                }
                kmCache.set(parsedRow.aracId as string, parsedRow.yapilanKm as number);
            }

            if (config.prismaModel === "muayene") {
                if (!parsedRow.aracId) { skipped++; continue; }
                if (!parsedRow.muayeneTarihi) {
                    parsedRow.muayeneTarihi = parsedRow.gecerlilikTarihi || new Date();
                }
            }

            if (config.prismaModel === "kullaniciZimmet") {
                if (!parsedRow.aracId || !parsedRow.kullaniciId) { skipped++; continue; }
                if (parsedRow.baslangicKm === undefined || parsedRow.baslangicKm === null) {
                    let km = kmCache.get(parsedRow.aracId as string);
                    if (km === undefined) {
                        const arac = await (getModelDelegate(tx, "arac") as any).findUnique({ where: { id: parsedRow.aracId }, select: { guncelKm: true } });
                        km = arac?.guncelKm || 0;
                    }
                    parsedRow.baslangicKm = km;
                }
                kmCache.set(parsedRow.aracId as string, parsedRow.baslangicKm as number);
            }

            if (config.prismaModel === "arac") {
                parsedRow.plaka = normalizeAracPlaka(parsedRow.plaka);
                parsedRow.saseNo = normalizeAracSaseNo(parsedRow.saseNo);
                parsedRow.motorNo = normalizeAracMotorNo(parsedRow.motorNo);
                sanitizeAracImportRow(parsedRow);
            }

            if (config.prismaModel === "kullanici") {
                if (entityKey === "kiralikPersonel") {
                    parsedRow.rol = "PERSONEL";
                    if (!normalizeLookupString(parsedRow.sirketId)) {
                        throw new Error(`Satir ${index + 2}: Çalıştığı firmamız zorunludur.`);
                    }
                    if (!normalizeLookupString(parsedRow.calistigiKurum)) {
                        parsedRow.calistigiKurum = await findSirketNameByIdForImport(tx, parsedRow.sirketId);
                    }
                }
                const aracHeader = resolveImportHeaderForRecord(availableHeaders, normalizedHeaderIndex, availableHeaders, normalizedHeaderIndex, getHeaderCandidates(profileKey, "zimmetliArac"));
                const rawAracVal = aracHeader ? record[aracHeader] : null;
                const normalizedPlaka = normalizeAracPlaka(rawAracVal);
                
                if (normalizedPlaka) {
                    const foundArac = await (getModelDelegate(tx, "arac") as any).findUnique({
                        where: { plaka: normalizedPlaka },
                        select: { id: true }
                    });
                    if (foundArac) {
                        (parsedRow as any)._targetAracId = foundArac.id;
                    }
                }
            }

            validateRequiredFields(fields, parsedRow, modelMeta.name);

            const whereUnique = getWhereUnique(fields, parsedRow, config.prismaModel);
            let existingId: string | null = null;
            if (whereUnique) {
                const exists = await model.findUnique({ where: whereUnique.where, select: { id: true } }) as { id: string } | null;
                existingId = exists?.id || null;
            }

            if (!existingId) {
                existingId = await findExistingBusinessRecord(tx, config.prismaModel, parsedRow) as string | null;
            }

            if (config.prismaModel === "arac" && parsedRow.kullaniciId) {
                const assignedAracId = await findAracIdByKullaniciIdForImport(tx, parsedRow.kullaniciId);
                if (assignedAracId && assignedAracId !== existingId) {
                    // Arac.kullaniciId benzersizdir; importu durdurmak yerine sadece çakışan zimmeti atlarız.
                    parsedRow.kullaniciId = undefined;
                }
            }

            const createData = config.prismaModel === "yakit" ? applyYakitRelationWritesForCreate(buildCreateData(fields, parsedRow)) : buildCreateData(fields, parsedRow);
            const updateData = config.prismaModel === "yakit" ? applyYakitRelationWritesForUpdate(buildUpdateData(fields, parsedRow, whereUnique?.uniqueFieldName), parsedRow) : buildUpdateData(fields, parsedRow, whereUnique?.uniqueFieldName);

            if (config.prismaModel === "bakim") {
                const prunedC = pruneDataByExistingColumns(createData, bakimExistingColumns);
                const prunedU = pruneDataByExistingColumns(updateData, bakimExistingColumns);
                Object.keys(createData).forEach(k => { if(!(k in prunedC)) delete createData[k]; });
                Object.keys(updateData).forEach(k => { if(!(k in prunedU)) delete updateData[k]; });
            }

            if (existingId) {
                await model.update({ where: { id: existingId }, data: updateData });
                updated++;
            } else if (config.prismaModel === "arac" && !parsedRow.plaka) {
                const id = await findExistingNoPlateAracId(tx, createData);
                if (id) { await model.update({ where: { id }, data: updateData }); updated++; }
                else { await createAracWithoutPlakaRaw(tx, createData); created++; }
            } else {
                const createdRecord = await model.create({ data: createData }) as { id: string };
                existingId = createdRecord.id;
                created++;
            }

            // Post-import vehicle assignment for personnel
            if (config.prismaModel === "kullanici" && existingId && (parsedRow as any)._targetAracId) {
                const targetAracId = (parsedRow as any)._targetAracId;
                const currentArac = await (getModelDelegate(tx, "arac") as any).findUnique({
                    where: { id: targetAracId },
                    select: { kullaniciId: true }
                });

                if (currentArac && currentArac.kullaniciId !== existingId) {
                    // Update vehicle's user
                    await (getModelDelegate(tx, "arac") as any).update({
                        where: { id: targetAracId },
                        data: { kullaniciId: existingId }
                    });
                    
                    // Also create a zimmet record if it doesn't exist for this active assignment
                    const existingZimmet = await (getModelDelegate(tx, "kullaniciZimmet") as any).findMany({
                        where: { aracId: targetAracId, kullaniciId: existingId, bitis: null },
                        take: 1
                    });

                    if (existingZimmet.length === 0) {
                        // Close any other active zimmet for this vehicle
                        await (getModelDelegate(tx, "kullaniciZimmet") as any).updateMany({
                            where: { aracId: targetAracId, bitis: null },
                            data: { bitis: new Date() }
                        });

                        await (getModelDelegate(tx, "kullaniciZimmet") as any).create({
                            data: {
                                aracId: targetAracId,
                                kullaniciId: existingId,
                                baslangic: new Date(new Date().getFullYear(), 0, 1),
                                baslangicKm: 0, // Fallback
                            }
                        });
                    }
                }
            }

        } catch (err) {
            console.error(`Import error at row ${index + 2}:`, err);
            throw err;
        }
    }

    return { created, updated, skipped, total: records.length };
}
