import type { DashboardComparisonGranularity, DashboardData, GenericWhere } from "@/lib/dashboard-types";
import { buildDateContext, getCezaScopeWhere, getDegisimYuzdesi } from "@/lib/dashboard-helpers";
import { getDashboardCostData, getDashboardFuelConsumptionData } from "@/lib/dashboard-cost.service";
import { getDashboardCalendarData } from "@/lib/dashboard-calendar.service";
import { getDashboardVehicleData, getFleetStatusData } from "@/lib/dashboard-vehicle.service";
import { getDashboardDriverData } from "@/lib/dashboard-driver.service";
import { getDashboardFuelAverageData } from "@/lib/dashboard-fuel-average.service";

export type {
    DashboardCalendarEvent,
    DashboardCompanyCostItem,
    DashboardComparisonGranularity,
    DashboardData,
    DashboardDriverCostItem,
    DashboardDriverFuelAverageItem,
    DashboardEventStatus,
    DashboardEventType,
    DashboardDailyTrendItem,
    DashboardWeeklyTrendItem,
    DashboardOperationArizaItem,
    DashboardMonthlyTrendItem,
    DashboardVehicleFuelAverageItem,
    DashboardVehicleCostItem,
} from "@/lib/dashboard-types";

function getEmptyDashboardData(): DashboardData {
    return {
        metrics: {
            aylikToplamGider: 0,
            oncekiDonemToplamGider: 0,
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
        weeklyExpenseTrend: [],
        vehicleCostReport: [],
        driverCostReport: [],
        companyCostReport: [],
        vehicleFuelAverageReport: [],
        driverFuelAverageReport: [],
    };
}

async function getDashboardDataUnsafe(
    sirketFilter: GenericWhere | null,
    vehicleScopeFilter: GenericWhere | null = null,
    selectedYil = new Date().getFullYear(),
    selectedAy = new Date().getMonth() + 1,
    comparisonGranularity: DashboardComparisonGranularity = "AY"
): Promise<DashboardData> {
    const scope = sirketFilter || {};
    const vehicleScope = vehicleScopeFilter || scope;
    const cezaScope = getCezaScopeWhere(scope);
    const dateContext = buildDateContext(selectedYil, selectedAy, comparisonGranularity);

    const [fleetData, costData, fuelConsumptionData, calendarData, vehicleData, driverData, fuelAverageData] = await Promise.all([
        getFleetStatusData(scope, vehicleScope),
        getDashboardCostData({ scope, cezaScope, vehicleScope, dateContext, comparisonGranularity }),
        getDashboardFuelConsumptionData({ scope, vehicleScope, dateContext }),
        getDashboardCalendarData({ scope, cezaScope, dateContext, vehicleScope }),
        getDashboardVehicleData({ scope, cezaScope, dateContext, vehicleScope }),
        getDashboardDriverData({ scope, cezaScope, dateContext, vehicleScope }),
        getDashboardFuelAverageData({ scope, dateContext, vehicleScope }),
    ]);

    const aylikToplamGider = costData.current.toplam;
    const oncekiDonemToplamGider = costData.previous.toplam;

    const ortalamaYakit = fuelConsumptionData.currentAverageLitresPer100Km;
    const oncekiOrtalamaYakit = fuelConsumptionData.previousAverageLitresPer100Km;

    const comparisonLabel = comparisonGranularity === "AY" ? "geçen aya göre" : "geçen yıla göre";

    return {
        metrics: {
            aylikToplamGider,
            oncekiDonemToplamGider,
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
        weeklyExpenseTrend: costData.weeklyExpenseTrend,
        vehicleCostReport: vehicleData.vehicleCostReport,
        driverCostReport: driverData.driverCostReport,
        companyCostReport: costData.companyCostReport,
        vehicleFuelAverageReport: fuelAverageData.vehicleFuelAverageReport,
        driverFuelAverageReport: fuelAverageData.driverFuelAverageReport,
    };
}

export async function getDashboardData(
    sirketFilter: GenericWhere | null,
    vehicleScopeFilter: GenericWhere | null = null,
    selectedYil = new Date().getFullYear(),
    selectedAy = new Date().getMonth() + 1,
    comparisonGranularity: DashboardComparisonGranularity = "AY"
): Promise<DashboardData> {
    try {
        return await getDashboardDataUnsafe(
            sirketFilter,
            vehicleScopeFilter,
            selectedYil,
            selectedAy,
            comparisonGranularity
        );
    } catch (error) {
        console.warn("Dashboard verileri alinamadi. Bos veri ile devam ediliyor.", error);
        return getEmptyDashboardData();
    }
}
