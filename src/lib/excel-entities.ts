export type ExcelEntityKey =
    | "arac"
    | "personel"
    | "sirket"
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
    personel: {
        prismaModel: "kullanici",
        filterModel: "personel",
        sheetName: "Personel",
        fileNamePrefix: "personeller",
    },
    sirket: {
        prismaModel: "sirket",
        filterModel: "sirket",
        sheetName: "Sirket",
        fileNamePrefix: "sirketler",
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
        sheetName: "Ariza",
        fileNamePrefix: "ariza-kayitlari",
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
