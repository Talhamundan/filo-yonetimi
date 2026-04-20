type FuelMetricRecord = {
    id: string;
    aracId: string;
    tarih: Date | string;
    km: number | null | undefined;
    litre: number;
    tutar: number;
    soforId?: string | null;
};

export type FuelIntervalMetric = {
    recordId: string;
    previousRecordId: string;
    aracId: string;
    distanceKm: number;
    litreUsed: number;
    amountUsed: number;
    averageLitresPer100Km: number;
    averageCostPerKm: number;
    averageCostPer100Km: number;
    soforId: string | null;
};

export type DriverFuelMetric = {
    driverId: string;
    intervalCount: number;
    totalDistanceKm: number;
    totalLitres: number;
    totalAmount: number;
    averageLitresPer100Km: number;
    averageCostPerKm: number;
    averageCostPer100Km: number;
};

export type VehicleFuelMetric = {
    vehicleId: string;
    intervalCount: number;
    totalDistanceKm: number;
    totalLitres: number;
    totalAmount: number;
    averageLitresPer100Km: number;
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

type DriverAccumulator = {
    intervalCount: number;
    totalDistanceKm: number;
    totalLitres: number;
    totalAmount: number;
};

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

    const driverAccumulators = new Map<string, DriverAccumulator>();
    const vehicleAccumulators = new Map<string, DriverAccumulator>();

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

            if (distanceKm <= 0) continue;

            const litreUsed = toSafeNumber(previous.litre);
            const amountUsed = toSafeNumber(previous.tutar);
            const averageLitresPer100Km = litreUsed > 0 ? (litreUsed / distanceKm) * 100 : 0;
            const averageCostPerKm = amountUsed > 0 ? amountUsed / distanceKm : 0;
            const averageCostPer100Km = averageCostPerKm * 100;
            const soforId = previous.soforId?.trim() || null;

            byCurrentRecordId.set(current.id, {
                recordId: current.id,
                previousRecordId: previous.id,
                aracId,
                distanceKm,
                litreUsed,
                amountUsed,
                averageLitresPer100Km,
                averageCostPerKm,
                averageCostPer100Km,
                soforId,
            });

            const vehicleAccumulator = vehicleAccumulators.get(aracId) || {
                intervalCount: 0,
                totalDistanceKm: 0,
                totalLitres: 0,
                totalAmount: 0,
            };
            vehicleAccumulator.intervalCount += 1;
            vehicleAccumulator.totalDistanceKm += distanceKm;
            vehicleAccumulator.totalLitres += litreUsed;
            vehicleAccumulator.totalAmount += amountUsed;
            vehicleAccumulators.set(aracId, vehicleAccumulator);

            if (!soforId) continue;

            const currentAccumulator = driverAccumulators.get(soforId) || {
                intervalCount: 0,
                totalDistanceKm: 0,
                totalLitres: 0,
                totalAmount: 0,
            };
            currentAccumulator.intervalCount += 1;
            currentAccumulator.totalDistanceKm += distanceKm;
            currentAccumulator.totalLitres += litreUsed;
            currentAccumulator.totalAmount += amountUsed;
            driverAccumulators.set(soforId, currentAccumulator);
        }
    }

    for (const [driverId, accumulator] of driverAccumulators.entries()) {
        if (accumulator.totalDistanceKm <= 0) continue;
        const averageLitresPer100Km = (accumulator.totalLitres / accumulator.totalDistanceKm) * 100;
        const averageCostPerKm = accumulator.totalAmount / accumulator.totalDistanceKm;
        byDriverId.set(driverId, {
            driverId,
            intervalCount: accumulator.intervalCount,
            totalDistanceKm: accumulator.totalDistanceKm,
            totalLitres: accumulator.totalLitres,
            totalAmount: accumulator.totalAmount,
            averageLitresPer100Km,
            averageCostPerKm,
            averageCostPer100Km: averageCostPerKm * 100,
        });
    }

    for (const [vehicleId, accumulator] of vehicleAccumulators.entries()) {
        if (accumulator.totalDistanceKm <= 0) continue;
        const averageLitresPer100Km = (accumulator.totalLitres / accumulator.totalDistanceKm) * 100;
        const averageCostPerKm = accumulator.totalAmount / accumulator.totalDistanceKm;
        byVehicleId.set(vehicleId, {
            vehicleId,
            intervalCount: accumulator.intervalCount,
            totalDistanceKm: accumulator.totalDistanceKm,
            totalLitres: accumulator.totalLitres,
            totalAmount: accumulator.totalAmount,
            averageLitresPer100Km,
            averageCostPerKm,
            averageCostPer100Km: averageCostPerKm * 100,
        });
    }

    return { byCurrentRecordId, byDriverId, byVehicleId };
}
