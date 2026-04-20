export type DetailRecord = Record<string, unknown>;

export function toFiniteNumber(value: unknown) {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

export function sumBy<T extends DetailRecord>(records: T[] | null | undefined, getValue: (record: T) => unknown) {
    return (records || []).reduce((total, record) => total + toFiniteNumber(getValue(record)), 0);
}

export function formatCurrency(value: number) {
    return `₺${value.toLocaleString("tr-TR")}`;
}

export function formatKm(value: number) {
    return `${value.toLocaleString("tr-TR")} km`;
}

export function formatLitres(value: number) {
    return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} L`;
}

function getTime(value: unknown) {
    const timestamp = value ? new Date(value as string | number | Date).getTime() : 0;
    return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getFuelKmDelta<T extends DetailRecord>(records: T[] | null | undefined) {
    const groupedRecords = new Map<string, Array<{ km: number; time: number; index: number }>>();

    (records || []).forEach((record, index) => {
        const km = toFiniteNumber(record.km);
        if (!Number.isFinite(km) || km <= 0) return;

        const aracId = typeof record.aracId === "string" && record.aracId.trim().length > 0 ? record.aracId : "__default__";
        const current = groupedRecords.get(aracId) || [];
        current.push({
            km,
            time: getTime(record.tarih),
            index,
        });
        groupedRecords.set(aracId, current);
    });

    let totalDelta = 0;
    groupedRecords.forEach((group) => {
        const sortedKmRecords = group.sort((a, b) => a.time - b.time || a.index - b.index);
        if (sortedKmRecords.length < 2) return;

        const firstKm = sortedKmRecords[0].km;
        const lastKm = sortedKmRecords[sortedKmRecords.length - 1].km;
        totalDelta += lastKm - firstKm;
    });

    return totalDelta;
}

export function getZimmetKmDelta<T extends DetailRecord>(records: T[] | null | undefined) {
    return (records || []).reduce((total, record) => {
        const startKm = toFiniteNumber(record.baslangicKm);
        const endKm = toFiniteNumber(record.bitisKm);
        if (endKm <= 0) return total;
        return total + (endKm - startKm);
    }, 0);
}
