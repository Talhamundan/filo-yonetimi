export type GenericWhere = Record<string, unknown>;

export type DashboardEventType = "TRAFIK" | "KASKO" | "MUAYENE" | "CEZA";
export type DashboardEventStatus = "GECIKTI" | "YUKSEK" | "KRITIK" | "YAKLASTI" | "PLANLI";
export type DashboardArizaOncelik = "KRITIK" | "YUKSEK" | "ORTA" | "DUSUK";
export type DashboardArizaDurumu = "ACIK" | "SERVISTE";

export interface DashboardCalendarEvent {
    id: string;
    aracId: string;
    plaka: string;
    aracMarka: string;
    sirketAd?: string | null;
    type: DashboardEventType;
    status: DashboardEventStatus;
    title: string;
    date: string;
    daysLeft: number;
    href: string;
}

export interface DashboardOperationArizaItem {
    id: string;
    aracId: string;
    plaka: string;
    oncelik: DashboardArizaOncelik;
    durum: DashboardArizaDurumu;
    aciklama: string;
    bildirimTarihi: string;
}

export interface DashboardMonthlyTrendItem {
    name: string;
    yakit: number;
    bakim: number;
    muayene: number;
    hgs: number;
    ceza: number;
    kasko: number;
    trafik: number;
    diger: number;
    toplam: number;
}

export interface DashboardVehicleCostItem {
    aracId: string;
    plaka: string;
    markaModel: string;
    toplam: number;
    yakit: number;
    bakim: number;
    muayene: number;
    hgs: number;
    ceza: number;
    kasko: number;
    trafik: number;
    diger: number;
}

export interface DashboardDriverCostItem {
    soforId: string | null;
    adSoyad: string;
    toplam: number;
    ceza: number;
    yakit: number;
    ariza: number;
}

export interface DashboardCompanyCostItem {
    sirketId: string | null;
    sirketAd: string;
    toplam: number;
    yakit: number;
    bakim: number;
    muayene: number;
    hgs: number;
    ceza: number;
    kasko: number;
    trafik: number;
    diger: number;
}

export interface DashboardData {
    metrics: {
        aylikToplamGider: number;
        ortalamaAracMaliyeti: number;
        ortalamaSoforMaliyeti: number;
        kritikUyariSayisi: number;
        verimlilikOrani: number;
        ortalamaYakit: number;
        aracMaliyetOrtalamaAdet: number;
        soforMaliyetOrtalamaAdet: number;
        aktifArac: number;
        toplamArac: number;
        servisteArac: number;
        arizaliArac: number;
        comparisonLabel: string;
        giderDegisimYuzdesi: number;
        servisMaliyetDegisimYuzdesi: number;
        aracMaliyetDegisimYuzdesi: number;
        soforMaliyetDegisimYuzdesi: number;
        yakitDegisimYuzdesi: number;
    };
    durumData: { name: string; value: number }[];
    alerts: { id: string; aracId: string; plaka: string; message: string; tarih: string }[];
    operationSummary: {
        kritik: number;
        yuksek: number;
        orta: number;
        dusuk: number;
        toplam: number;
        serviste: number;
    };
    operationArizalar: DashboardOperationArizaItem[];
    sixMonthsTrend: { name: string; gider: number }[];
    top5Expenses: { plaka: string; tutar: number }[];
    calendarEvents: DashboardCalendarEvent[];
    monthlyExpenseTrend: DashboardMonthlyTrendItem[];
    vehicleCostReport: DashboardVehicleCostItem[];
    driverCostReport: DashboardDriverCostItem[];
    companyCostReport: DashboardCompanyCostItem[];
}

export type DashboardComparisonGranularity = "AY" | "YIL";

export type DashboardDateContext = {
    bugun: Date;
    seciliAyBasi: Date;
    seciliAySonu: Date;
    oncekiDonemBasi: Date;
    oncekiDonemSonu: Date;
    normalizedYear: number;
    normalizedMonth: number;
};

export type CostBreakdown = {
    yakit: number;
    bakim: number;
    muayene: number;
    hgs: number;
    ceza: number;
    kasko: number;
    trafik: number;
    diger: number;
    toplam: number;
};
