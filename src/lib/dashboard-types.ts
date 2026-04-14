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
    yakitLitre?: number;
    bakim: number;
    muayene: number;
    ceza: number;
    kasko: number;
    trafik: number;
    diger: number;
    toplam: number;
}

export interface DashboardDailyTrendItem {
    dateKey: string;
    gun: number;
    name: string;
    yakit: number;
    yakitLitre?: number;
    bakim: number;
    muayene: number;
    ceza: number;
    kasko: number;
    trafik: number;
    diger: number;
    toplam: number;
}

export interface DashboardWeeklyTrendItem {
    weekKey: string;
    hafta: number;
    name: string;
    rangeLabel: string;
    yakit: number;
    yakitLitre?: number;
    bakim: number;
    muayene: number;
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
    yakitLitre?: number;
    bakim: number;
    muayene: number;
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
    yakitLitre?: number;
    ariza: number;
}

export interface DashboardCompanyCostItem {
    sirketId: string | null;
    sirketAd: string;
    toplam: number;
    yakit: number;
    yakitLitre?: number;
    bakim: number;
    muayene: number;
    ceza: number;
    kasko: number;
    trafik: number;
    diger: number;
}

export interface DashboardVehicleFuelAverageItem {
    aracId: string;
    plaka: string;
    markaModel: string;
    averageLitresPer100Km: number;
    intervalCount: number;
}

export interface DashboardDriverFuelAverageItem {
    soforId: string;
    adSoyad: string;
    averageLitresPer100Km: number;
    intervalCount: number;
    fleetAverageLitresPer100Km?: number;
    isAboveFleetAverage?: boolean;
}

export interface DashboardData {
    metrics: {
        aylikToplamGider: number;
        oncekiDonemToplamGider: number;
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
        toplamTankKapasite: number;
        toplamTankMevcut: number;
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
    dailyExpenseTrend: DashboardDailyTrendItem[];
    weeklyExpenseTrend: DashboardWeeklyTrendItem[];
    vehicleCostReport: DashboardVehicleCostItem[];
    driverCostReport: DashboardDriverCostItem[];
    companyCostReport: DashboardCompanyCostItem[];
    vehicleFuelAverageReport: DashboardVehicleFuelAverageItem[];
    driverFuelAverageReport: DashboardDriverFuelAverageItem[];
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
    ceza: number;
    kasko: number;
    trafik: number;
    diger: number;
    toplam: number;
};
