import { normalizeAracAltKategori } from "@/lib/arac-kategori";

export type FuelConsumptionUnit = "LITRE_PER_100_KM" | "LITRE_PER_HOUR";

type FuelMetricRecord = {
    id: string;
    aracId: string;
    tarih: Date | string;
    km: number | null | undefined;
    litre: number;
    tutar: number;
    soforId?: string | null;
    consumptionUnit?: FuelConsumptionUnit | null;
};

export type FuelIntervalMetric = {
    recordId: string;
    previousRecordId: string;
    aracId: string;
    distanceKm: number;
    distanceUnit: "KM" | "HOUR";
    consumptionUnit: FuelConsumptionUnit;
    litreUsed: number;
    amountUsed: number;
    averageLitresPerUnit: number;
    averageLitresPer100Km: number;
    averageCostPerUnit: number;
    averageCostPerKm: number;
    averageCostPer100Km: number;
    soforId: string | null;
};

export type DriverFuelMetric = {
    driverId: string;
    intervalCount: number;
    totalDistanceKm: number;
    distanceUnit: "KM" | "HOUR";
    consumptionUnit: FuelConsumptionUnit;
    totalLitres: number;
    totalAmount: number;
    averageLitresPerUnit: number;
    averageLitresPer100Km: number;
    averageCostPerUnit: number;
    averageCostPerKm: number;
    averageCostPer100Km: number;
};

export type VehicleFuelMetric = {
    vehicleId: string;
    intervalCount: number;
    totalDistanceKm: number;
    distanceUnit: "KM" | "HOUR";
    consumptionUnit: FuelConsumptionUnit;
    totalLitres: number;
    totalAmount: number;
    averageLitresPerUnit: number;
    averageLitresPer100Km: number;
    averageCostPerUnit: number;
    averageCostPerKm: number;
    averageCostPer100Km: number;
};

function toTimestamp(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function toSafeNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeFuelConsumptionUnit(value: unknown): FuelConsumptionUnit {
    return value === "LITRE_PER_HOUR" ? "LITRE_PER_HOUR" : "LITRE_PER_100_KM";
}

function getDistanceUnit(value: FuelConsumptionUnit): "KM" | "HOUR" {
    return value === "LITRE_PER_HOUR" ? "HOUR" : "KM";
}

function getConsumptionFactor(value: FuelConsumptionUnit) {
    return value === "LITRE_PER_HOUR" ? 1 : 100;
}

function toAccumulatorKey(id: string, consumptionUnit: FuelConsumptionUnit) {
    return `${id}::${consumptionUnit}`;
}

function fromAccumulatorKey(key: string) {
    const separatorIndex = key.lastIndexOf("::");
    if (separatorIndex <= 0) {
        return {
            id: key,
            consumptionUnit: "LITRE_PER_100_KM" as FuelConsumptionUnit,
        };
    }
    return {
        id: key.slice(0, separatorIndex),
        consumptionUnit: normalizeFuelConsumptionUnit(key.slice(separatorIndex + 2)),
    };
}

function pickBestMetric<T extends { intervalCount: number; totalDistanceKm: number; totalLitres: number }>(items: T[]) {
    if (items.length === 1) return items[0];
    return [...items].sort((a, b) => {
        if (b.intervalCount !== a.intervalCount) return b.intervalCount - a.intervalCount;
        if (b.totalDistanceKm !== a.totalDistanceKm) return b.totalDistanceKm - a.totalDistanceKm;
        return b.totalLitres - a.totalLitres;
    })[0];
}

type FuelAccumulator = {
    intervalCount: number;
    totalDistanceKm: number;
    totalLitres: number;
    totalAmount: number;
    consumptionUnit: FuelConsumptionUnit;
};

export function getFuelConsumptionUnitByAltKategori(altKategori: unknown): FuelConsumptionUnit {
    return normalizeAracAltKategori(altKategori) === "IS_MAKINESI" ? "LITRE_PER_HOUR" : "LITRE_PER_100_KM";
}

export function buildFuelIntervalMetrics(records: FuelMetricRecord[]) {
    const byCurrentRecordId = new Map<string, FuelIntervalMetric>();
    const byDriverId = new Map<string, DriverFuelMetric>();
    const byVehicleId = new Map<string, VehicleFuelMetric>();
    const groupedByVehicle = new Map<string, FuelMetricRecord[]>();

    for (const record of records) {
        if (!record?.id || !record?.aracId) continue;
        const km = toSafeNumber(record.km);
        if (km <= 0) continue;
        const list = groupedByVehicle.get(record.aracId) || [];
        list.push(record);
        groupedByVehicle.set(record.aracId, list);
    }

    const driverAccumulators = new Map<string, FuelAccumulator>();
    const vehicleAccumulators = new Map<string, FuelAccumulator>();

    for (const [aracId, vehicleRecords] of groupedByVehicle.entries()) {
        const sorted = [...vehicleRecords].sort((a, b) => {
            const timeDiff = toTimestamp(a.tarih) - toTimestamp(b.tarih);
            if (timeDiff !== 0) return timeDiff;
            return toSafeNumber(a.km) - toSafeNumber(b.km);
        });

        for (let index = 1; index < sorted.length; index += 1) {
            const previous = sorted[index - 1];
            const current = sorted[index];
            const previousKm = toSafeNumber(previous.km);
            const currentKm = toSafeNumber(current.km);
            const distanceKm = currentKm - previousKm;
            const consumptionUnit = normalizeFuelConsumptionUnit(current.consumptionUnit ?? previous.consumptionUnit);

            if (distanceKm <= 0) continue;

            const litreUsed = toSafeNumber(previous.litre);
            const amountUsed = toSafeNumber(previous.tutar);
            const factor = getConsumptionFactor(consumptionUnit);
            const averageLitresPerUnit = litreUsed > 0 ? (litreUsed / distanceKm) * factor : 0;
            const averageCostPerUnit = amountUsed > 0 ? amountUsed / distanceKm : 0;
            const averageCostPer100Km =
                consumptionUnit === "LITRE_PER_100_KM" ? averageCostPerUnit * 100 : averageCostPerUnit;
            const soforId = previous.soforId?.trim() || null;

            byCurrentRecordId.set(current.id, {
                recordId: current.id,
                previousRecordId: previous.id,
                aracId,
                distanceKm,
                distanceUnit: getDistanceUnit(consumptionUnit),
                consumptionUnit,
                litreUsed,
                amountUsed,
                averageLitresPerUnit,
                averageLitresPer100Km: averageLitresPerUnit,
                averageCostPerUnit,
                averageCostPerKm: averageCostPerUnit,
                averageCostPer100Km,
                soforId,
            });

            const vehicleKey = toAccumulatorKey(aracId, consumptionUnit);
            const vehicleAccumulator = vehicleAccumulators.get(vehicleKey) || {
                intervalCount: 0,
                totalDistanceKm: 0,
                totalLitres: 0,
                totalAmount: 0,
                consumptionUnit,
            };
            vehicleAccumulator.intervalCount += 1;
            vehicleAccumulator.totalDistanceKm += distanceKm;
            vehicleAccumulator.totalLitres += litreUsed;
            vehicleAccumulator.totalAmount += amountUsed;
            vehicleAccumulators.set(vehicleKey, vehicleAccumulator);

            if (!soforId) continue;

            const driverKey = toAccumulatorKey(soforId, consumptionUnit);
            const currentAccumulator = driverAccumulators.get(driverKey) || {
                intervalCount: 0,
                totalDistanceKm: 0,
                totalLitres: 0,
                totalAmount: 0,
                consumptionUnit,
            };
            currentAccumulator.intervalCount += 1;
            currentAccumulator.totalDistanceKm += distanceKm;
            currentAccumulator.totalLitres += litreUsed;
            currentAccumulator.totalAmount += amountUsed;
            driverAccumulators.set(driverKey, currentAccumulator);
        }
    }

    const driverCandidatesByDriverId = new Map<string, DriverFuelMetric[]>();
    for (const [driverKey, accumulator] of driverAccumulators.entries()) {
        const { id: driverId, consumptionUnit } = fromAccumulatorKey(driverKey);
        if (accumulator.totalDistanceKm <= 0) continue;
        const factor = getConsumptionFactor(consumptionUnit);
        const averageLitresPerUnit = (accumulator.totalLitres / accumulator.totalDistanceKm) * factor;
        const averageCostPerUnit = accumulator.totalAmount / accumulator.totalDistanceKm;
        const metric: DriverFuelMetric = {
            driverId,
            intervalCount: accumulator.intervalCount,
            totalDistanceKm: accumulator.totalDistanceKm,
            distanceUnit: getDistanceUnit(consumptionUnit),
            consumptionUnit,
            totalLitres: accumulator.totalLitres,
            totalAmount: accumulator.totalAmount,
            averageLitresPerUnit,
            averageLitresPer100Km: averageLitresPerUnit,
            averageCostPerUnit,
            averageCostPerKm: averageCostPerUnit,
            averageCostPer100Km:
                consumptionUnit === "LITRE_PER_100_KM" ? averageCostPerUnit * 100 : averageCostPerUnit,
        };
        const list = driverCandidatesByDriverId.get(driverId) || [];
        list.push(metric);
        driverCandidatesByDriverId.set(driverId, list);
    }

    for (const [driverId, metrics] of driverCandidatesByDriverId.entries()) {
        byDriverId.set(driverId, pickBestMetric(metrics));
    }

    const vehicleCandidatesByVehicleId = new Map<string, VehicleFuelMetric[]>();
    for (const [vehicleKey, accumulator] of vehicleAccumulators.entries()) {
        const { id: vehicleId, consumptionUnit } = fromAccumulatorKey(vehicleKey);
        if (accumulator.totalDistanceKm <= 0) continue;
        const factor = getConsumptionFactor(consumptionUnit);
        const averageLitresPerUnit = (accumulator.totalLitres / accumulator.totalDistanceKm) * factor;
        const averageCostPerUnit = accumulator.totalAmount / accumulator.totalDistanceKm;
        const metric: VehicleFuelMetric = {
            vehicleId,
            intervalCount: accumulator.intervalCount,
            totalDistanceKm: accumulator.totalDistanceKm,
            distanceUnit: getDistanceUnit(consumptionUnit),
            consumptionUnit,
            totalLitres: accumulator.totalLitres,
            totalAmount: accumulator.totalAmount,
            averageLitresPerUnit,
            averageLitresPer100Km: averageLitresPerUnit,
            averageCostPerUnit,
            averageCostPerKm: averageCostPerUnit,
            averageCostPer100Km:
                consumptionUnit === "LITRE_PER_100_KM" ? averageCostPerUnit * 100 : averageCostPerUnit,
        };
        const list = vehicleCandidatesByVehicleId.get(vehicleId) || [];
        list.push(metric);
        vehicleCandidatesByVehicleId.set(vehicleId, list);
    }

    for (const [vehicleId, metrics] of vehicleCandidatesByVehicleId.entries()) {
        byVehicleId.set(vehicleId, pickBestMetric(metrics));
    }

    return { byCurrentRecordId, byDriverId, byVehicleId };
}
