import type { DashboardComparisonGranularity, DashboardData, GenericWhere } from "@/lib/dashboard-types";
import { buildDateContext, getCezaScopeWhere, getDegisimYuzdesi } from "@/lib/dashboard-helpers";
import { getDashboardCostData } from "@/lib/dashboard-cost.service";
import { getDashboardCalendarData } from "@/lib/dashboard-calendar.service";
import { getDashboardVehicleData, getFleetStatusData } from "@/lib/dashboard-vehicle.service";
import { getDashboardDriverData } from "@/lib/dashboard-driver.service";

export type {
    DashboardCalendarEvent,
    DashboardCompanyCostItem,
    DashboardComparisonGranularity,
    DashboardData,
    DashboardDriverCostItem,
    DashboardEventStatus,
    DashboardEventType,
    DashboardDailyTrendItem,
    DashboardOperationArizaItem,
    DashboardMonthlyTrendItem,
    DashboardVehicleCostItem,
} from "@/lib/dashboard-types";

function getEmptyDashboardData(): DashboardData {
    return {
        metrics: {
            aylikToplamGider: 0,
            ortalamaAracMaliyeti: 0,
            ortalamaSoforMaliyeti: 0,
            kritikUyariSayisi: 0,
            verimlilikOrani: 0,
            ortalamaYakit: 0,
            aracMaliyetOrtalamaAdet: 0,
            soforMaliyetOrtalamaAdet: 0,
            aktifArac: 0,
            toplamArac: 0,
            servisteArac: 0,
            arizaliArac: 0,
            comparisonLabel: "geçen aya göre",
            giderDegisimYuzdesi: 0,
            servisMaliyetDegisimYuzdesi: 0,
            aracMaliyetDegisimYuzdesi: 0,
            soforMaliyetDegisimYuzdesi: 0,
            yakitDegisimYuzdesi: 0,
        },
        durumData: [],
        alerts: [],
        operationSummary: {
            kritik: 0,
            yuksek: 0,
            orta: 0,
            dusuk: 0,
            toplam: 0,
            serviste: 0,
        },
        operationArizalar: [],
        sixMonthsTrend: [],
        top5Expenses: [],
        calendarEvents: [],
        monthlyExpenseTrend: [],
        dailyExpenseTrend: [],
        vehicleCostReport: [],
        driverCostReport: [],
        companyCostReport: [],
    };
}

async function getDashboardDataUnsafe(
    sirketFilter: GenericWhere | null,
    selectedYil = new Date().getFullYear(),
    selectedAy = new Date().getMonth() + 1,
    comparisonGranularity: DashboardComparisonGranularity = "AY"
): Promise<DashboardData> {
    const scope = sirketFilter || {};
    const cezaScope = getCezaScopeWhere(scope);
    const dateContext = buildDateContext(selectedYil, selectedAy, comparisonGranularity);

    const [fleetData, costData, calendarData, vehicleData, driverData] = await Promise.all([
        getFleetStatusData(scope),
        getDashboardCostData({ scope, cezaScope, dateContext, comparisonGranularity }),
        getDashboardCalendarData({ scope, cezaScope, dateContext }),
        getDashboardVehicleData({ scope, cezaScope, dateContext }),
        getDashboardDriverData({ scope, cezaScope, dateContext }),
    ]);

    const aylikToplamGider = costData.current.toplam;
    const oncekiDonemToplamGider = costData.previous.toplam;

    const ortalamaYakit = fleetData.aktifArac > 0 ? Math.round(costData.current.yakit / fleetData.aktifArac) : 0;
    const oncekiOrtalamaYakit = fleetData.aktifArac > 0 ? Math.round(costData.previous.yakit / fleetData.aktifArac) : 0;

    const comparisonLabel = comparisonGranularity === "AY" ? "geçen aya göre" : "geçen yıla göre";

    return {
        metrics: {
            aylikToplamGider,
            ortalamaAracMaliyeti: vehicleData.ortalamaAracMaliyeti,
            ortalamaSoforMaliyeti: driverData.ortalamaSoforMaliyeti,
            kritikUyariSayisi: calendarData.kritikUyariSayisi,
            verimlilikOrani: fleetData.verimlilikOrani,
            ortalamaYakit,
            aracMaliyetOrtalamaAdet: vehicleData.aracMaliyetOrtalamaAdet,
            soforMaliyetOrtalamaAdet: driverData.soforMaliyetOrtalamaAdet,
            aktifArac: fleetData.aktifArac,
            toplamArac: fleetData.toplamArac,
            servisteArac: fleetData.servisteArac,
            arizaliArac: fleetData.arizaliArac,
            comparisonLabel,
            giderDegisimYuzdesi: getDegisimYuzdesi(aylikToplamGider, oncekiDonemToplamGider),
            servisMaliyetDegisimYuzdesi: getDegisimYuzdesi(costData.current.bakim, costData.previous.bakim),
            aracMaliyetDegisimYuzdesi: getDegisimYuzdesi(
                vehicleData.ortalamaAracMaliyeti,
                vehicleData.oncekiOrtalamaAracMaliyeti
            ),
            soforMaliyetDegisimYuzdesi: getDegisimYuzdesi(
                driverData.ortalamaSoforMaliyeti,
                driverData.oncekiOrtalamaSoforMaliyeti
            ),
            yakitDegisimYuzdesi: getDegisimYuzdesi(ortalamaYakit, oncekiOrtalamaYakit),
        },
        durumData: fleetData.durumData,
        alerts: calendarData.alerts,
        operationSummary: calendarData.operationSummary,
        operationArizalar: calendarData.operationArizalar,
        sixMonthsTrend: costData.sixMonthsTrend,
        top5Expenses: vehicleData.top5Expenses,
        calendarEvents: calendarData.calendarEvents,
        monthlyExpenseTrend: costData.monthlyExpenseTrend,
        dailyExpenseTrend: costData.dailyExpenseTrend,
        vehicleCostReport: vehicleData.vehicleCostReport,
        driverCostReport: driverData.driverCostReport,
        companyCostReport: costData.companyCostReport,
    };
}

export async function getDashboardData(
    sirketFilter: GenericWhere | null,
    selectedYil = new Date().getFullYear(),
    selectedAy = new Date().getMonth() + 1,
    comparisonGranularity: DashboardComparisonGranularity = "AY"
): Promise<DashboardData> {
    try {
        return await getDashboardDataUnsafe(sirketFilter, selectedYil, selectedAy, comparisonGranularity);
    } catch (error) {
        console.warn("Dashboard verileri alinamadi. Bos veri ile devam ediliyor.", error);
        return getEmptyDashboardData();
    }
}
