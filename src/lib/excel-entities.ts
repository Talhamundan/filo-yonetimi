export type ExcelEntityKey =
    | "arac"
    | "kiralikArac"
    | "taseronArac"
    | "personel"
    | "kiralikPersonel"
    | "taseronPersonel"
    | "sirket"
    | "disFirma"
    | "taseronFirma"
    | "kiralikFirma"
    | "zimmet"
    | "ariza"
    | "bakim"
    | "yakit"
    | "muayene"
    | "kasko"
    | "trafikSigortasi"
    | "masraf"
    | "ceza"
    | "dokuman";

type ExcelEntityConfig = {
    prismaModel: string;
    filterModel: string;
    dateField?: string;
    sheetName: string;
    fileNamePrefix: string;
};

export const EXCEL_ENTITY_CONFIG: Record<ExcelEntityKey, ExcelEntityConfig> = {
    arac: {
        prismaModel: "arac",
        filterModel: "arac",
        sheetName: "Arac",
        fileNamePrefix: "araclar",
    },
    kiralikArac: {
        prismaModel: "arac",
        filterModel: "arac",
        sheetName: "KiralikArac",
        fileNamePrefix: "kiralik-araclar",
    },
    taseronArac: {
        prismaModel: "arac",
        filterModel: "arac",
        sheetName: "TaseronArac",
        fileNamePrefix: "taseron-araclar",
    },
    personel: {
        prismaModel: "kullanici",
        filterModel: "personel",
        sheetName: "Personel",
        fileNamePrefix: "personeller",
    },
    kiralikPersonel: {
        prismaModel: "kullanici",
        filterModel: "personel",
        sheetName: "KiralikPersonel",
        fileNamePrefix: "kiralik-personeller",
    },
    taseronPersonel: {
        prismaModel: "kullanici",
        filterModel: "personel",
        sheetName: "TaseronPersonel",
        fileNamePrefix: "taseron-personeller",
    },
    sirket: {
        prismaModel: "sirket",
        filterModel: "sirket",
        sheetName: "Sirket",
        fileNamePrefix: "sirketler",
    },
    disFirma: {
        prismaModel: "disFirma",
        filterModel: "disFirma",
        sheetName: "DisFirmalar",
        fileNamePrefix: "dis-firmalar",
    },
    taseronFirma: {
        prismaModel: "disFirma",
        filterModel: "disFirma",
        sheetName: "TaseronFirmalar",
        fileNamePrefix: "taseron-firmalar",
    },
    kiralikFirma: {
        prismaModel: "disFirma",
        filterModel: "disFirma",
        sheetName: "KiralikFirmalar",
        fileNamePrefix: "kiralik-firmalar",
    },
    zimmet: {
        prismaModel: "kullaniciZimmet",
        filterModel: "kullaniciZimmet",
        dateField: "baslangic",
        sheetName: "Zimmet",
        fileNamePrefix: "zimmetler",
    },
    ariza: {
        prismaModel: "arizaKaydi",
        filterModel: "arizaKaydi",
        dateField: "bildirimTarihi",
        sheetName: "Kaza",
        fileNamePrefix: "kaza-kayitlari",
    },
    bakim: {
        prismaModel: "bakim",
        filterModel: "bakim",
        dateField: "bakimTarihi",
        sheetName: "Bakim",
        fileNamePrefix: "servis-kayitlari",
    },
    yakit: {
        prismaModel: "yakit",
        filterModel: "yakit",
        dateField: "tarih",
        sheetName: "Yakit",
        fileNamePrefix: "yakitlar",
    },
    muayene: {
        prismaModel: "muayene",
        filterModel: "muayene",
        dateField: "gecerlilikTarihi",
        sheetName: "Muayene",
        fileNamePrefix: "muayeneler",
    },
    kasko: {
        prismaModel: "kasko",
        filterModel: "kasko",
        dateField: "baslangicTarihi",
        sheetName: "Kasko",
        fileNamePrefix: "kasko",
    },
    trafikSigortasi: {
        prismaModel: "trafikSigortasi",
        filterModel: "trafikSigortasi",
        dateField: "baslangicTarihi",
        sheetName: "TrafikSigortasi",
        fileNamePrefix: "trafik-sigortasi",
    },
    masraf: {
        prismaModel: "masraf",
        filterModel: "masraf",
        dateField: "tarih",
        sheetName: "Masraf",
        fileNamePrefix: "masraflar",
    },
    ceza: {
        prismaModel: "ceza",
        filterModel: "ceza",
        dateField: "tarih",
        sheetName: "Ceza",
        fileNamePrefix: "cezalar",
    },
    dokuman: {
        prismaModel: "dokuman",
        filterModel: "dokuman",
        dateField: "yuklemeTarihi",
        sheetName: "Dokuman",
        fileNamePrefix: "dokumanlar",
    },
};

export function isExcelEntityKey(value: string): value is ExcelEntityKey {
    return Object.prototype.hasOwnProperty.call(EXCEL_ENTITY_CONFIG, value);
}
