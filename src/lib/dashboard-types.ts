// ──────────────────────────────────────────────
// Genel yardımcı tipler
// ──────────────────────────────────────────────

/** Prisma where koşullarında kullanılan genel anahtar-değer tipi */
export type GenericWhere = Record<string, unknown>;

/** Dashboard karşılaştırma granülaritesi: aylık veya yıllık */
export type DashboardComparisonGranularity = "AY" | "YIL";

// ──────────────────────────────────────────────
// Tarih bağlamı
// ──────────────────────────────────────────────

export type DashboardDateContext = {
    bugun: Date;
    seciliAyBasi: Date;
    seciliAySonu: Date;
    oncekiDonemBasi: Date;
    oncekiDonemSonu: Date;
    normalizedYear: number;
    normalizedMonth: number;
};

// ──────────────────────────────────────────────
// Dashboard ana veri yapısı
// ──────────────────────────────────────────────

export type DashboardData = {
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
    alerts: {
        id: string;
        aracId: string;
        plaka: string;
        message: string;
        tarih: string;
    }[];
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
    ownershipCostReport: DashboardOwnershipCostItem[];
    vehicleFuelAverageReport: DashboardVehicleFuelAverageItem[];
    driverFuelAverageReport: DashboardDriverFuelAverageItem[];
    stokOzet: DashboardStockItem[];
};

// ──────────────────────────────────────────────
// Maliyet dökümü
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// Takvim etkinlikleri
// ──────────────────────────────────────────────

export type DashboardEventType = "MUAYENE" | "KASKO" | "TRAFIK" | "CEZA";
export type DashboardEventStatus = "GECIKTI" | "YUKSEK" | "KRITIK" | "YAKLASTI" | "PLANLI";

export type DashboardCalendarEvent = {
    id: string;
    aracId: string;
    plaka: string;
    aracMarka: string;
    sirketAd: string | null;
    type: DashboardEventType;
    status: DashboardEventStatus;
    title: string;
    date: string;
    daysLeft: number;
    href: string;
};

// ──────────────────────────────────────────────
// Arıza önceliği
// ──────────────────────────────────────────────

export type DashboardArizaOncelik = "KRITIK" | "YUKSEK" | "ORTA" | "DUSUK";

export type DashboardOperationArizaItem = {
    id: string;
    aracId: string;
    plaka: string;
    oncelik: DashboardArizaOncelik;
    durum: "ACIK" | "SERVISTE";
    aciklama: string;
    bildirimTarihi: string;
};

// ──────────────────────────────────────────────
// Trend verileri
// ──────────────────────────────────────────────

export type DashboardMonthlyTrendItem = {
    ay?: number;
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
};

export type DashboardDailyTrendItem = {
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
};

export type DashboardWeeklyTrendItem = {
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
};

// ──────────────────────────────────────────────
// Rapor öğeleri
// ──────────────────────────────────────────────

export type DashboardVehicleCostItem = {
    aracId: string;
    plaka: string;
    markaModel: string;
    toplam: number;
    yakit: number;
    yakitLitre: number;
    bakim: number;
    muayene: number;
    ceza: number;
    kasko: number;
    trafik: number;
    diger: number;
};

export type DashboardDriverCostItem = {
    soforId: string;
    adSoyad: string;
    ceza: number;
    yakit: number;
    yakitLitre: number;
    ariza: number;
    toplam: number;
};

export type DashboardCompanyCostItem = {
    sirketId: string | null;
    sirketAd: string;
    yakit: number;
    yakitLitre: number;
    bakim: number;
    muayene: number;
    ceza: number;
    kasko: number;
    trafik: number;
    diger: number;
    toplam: number;
};

export type DashboardOwnershipCostItem = {
    sirketId: string | null;
    sirketAd: string;
    ozMal: number;
    kiralik: number;
    taseron: number;
    yakit: number;
    servis: number;
    toplam: number;
};

export type DashboardVehicleFuelAverageItem = {
    aracId: string;
    plaka: string;
    markaModel: string;
    averageLitresPer100Km: number;
    intervalCount: number;
    consumptionUnit?: "LITRE_PER_100_KM" | "LITRE_PER_HOUR";
};

export type DashboardDriverFuelAverageItem = {
    soforId: string;
    adSoyad: string;
    averageLitresPer100Km: number;
    intervalCount: number;
    consumptionUnit?: "LITRE_PER_100_KM" | "LITRE_PER_HOUR";
    fleetAverageLitresPer100Km?: number;
    isAboveFleetAverage?: boolean;
};

export type DashboardStockItem = {
    id: string;
    ad: string;
    miktar: number;
    birim: string;
    kritikSeviye: number | null;
    kritikMi: boolean;
};
