import prisma from "@/lib/prisma";

type TxClient = typeof prisma | any;

type CurrentRecordKm = {
    aracId?: string | null;
    km?: number | null;
};

const LEGACY_SCHEMA_PATTERNS = [
    "Unknown arg",
    "Unknown field",
    "does not exist",
    "Invalid `",
];

function isLegacySchemaError(error: unknown) {
    const message = String((error as any)?.message || "");
    return LEGACY_SCHEMA_PATTERNS.some((pattern) => message.includes(pattern));
}

function formatKm(value: number) {
    return value.toLocaleString("tr-TR");
}

export function normalizeKmInput(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("KM degeri 0 veya daha buyuk bir sayi olmali.");
    }

    return Math.trunc(parsed);
}

async function safeAggregateMax(
    tx: TxClient,
    modelName: string,
    fieldName: string,
    aracId: string
) {
    const model = tx?.[modelName];
    if (!model?.aggregate) {
        return 0;
    }

    try {
        const result = await model.aggregate({
            where: { aracId },
            _max: { [fieldName]: true },
        });

        const value = result?._max?.[fieldName];
        return typeof value === "number" && Number.isFinite(value) ? value : 0;
    } catch (error) {
        if (isLegacySchemaError(error)) {
            return 0;
        }
        throw error;
    }
}

export async function getAracMaxKnownKm(aracId: string, tx: TxClient = prisma) {
    const aracRow = await tx.arac.findUnique({
        where: { id: aracId },
        select: { guncelKm: true },
    });
    const aracKm = Number(aracRow?.guncelKm || 0);

    const [
        yakitKm,
        bakimKm,
        muayeneKm,
        hgsKm,
        cezaKm,
        zimmetBaslangicKm,
        zimmetBitisKm,
    ] = await Promise.all([
        safeAggregateMax(tx, "yakit", "km", aracId),
        safeAggregateMax(tx, "bakim", "yapilanKm", aracId),
        safeAggregateMax(tx, "muayene", "km", aracId),
        safeAggregateMax(tx, "hgsYukleme", "km", aracId),
        safeAggregateMax(tx, "ceza", "km", aracId),
        safeAggregateMax(tx, "kullaniciZimmet", "baslangicKm", aracId),
        safeAggregateMax(tx, "kullaniciZimmet", "bitisKm", aracId),
    ]);

    return Math.max(
        aracKm,
        yakitKm,
        bakimKm,
        muayeneKm,
        hgsKm,
        cezaKm,
        zimmetBaslangicKm,
        zimmetBitisKm
    );
}

export async function assertKmWriteConsistency(params: {
    aracId: string;
    km: unknown;
    fieldLabel?: string;
    currentRecord?: CurrentRecordKm;
    enforceMaxKnownKm?: boolean;
    tx?: TxClient;
}) {
    const {
        aracId,
        km,
        fieldLabel = "KM",
        currentRecord,
        enforceMaxKnownKm = true,
        tx = prisma,
    } = params;
    const normalizedKm = normalizeKmInput(km);

    if (normalizedKm === null) {
        return null;
    }

    const currentKm = normalizeKmInput(currentRecord?.km);
    if (
        currentRecord?.aracId === aracId &&
        currentKm !== null &&
        currentKm === normalizedKm
    ) {
        return normalizedKm;
    }

    if (enforceMaxKnownKm) {
        const maxKnownKm = await getAracMaxKnownKm(aracId, tx);
        if (normalizedKm < maxKnownKm) {
            throw new Error(
                `${fieldLabel} (${formatKm(normalizedKm)} km) mevcut en yuksek degerden (${formatKm(
                    maxKnownKm
                )} km) dusuk olamaz.`
            );
        }
    }

    return normalizedKm;
}

export async function syncAracGuncelKm(aracId: string, tx: TxClient = prisma) {
    const maxKnownKm = await getAracMaxKnownKm(aracId, tx);

    await tx.arac.updateMany({
        where: {
            id: aracId,
            guncelKm: { lt: maxKnownKm },
        },
        data: { guncelKm: maxKnownKm },
    });

    return maxKnownKm;
}

export async function resolveAracGuncelKmForUpdate(
    aracId: string,
    requestedKm: unknown,
    tx: TxClient = prisma
) {
    const normalizedRequestedKm = normalizeKmInput(requestedKm);
    const maxKnownKm = await getAracMaxKnownKm(aracId, tx);

    if (normalizedRequestedKm === null) {
        return maxKnownKm;
    }

    return Math.max(normalizedRequestedKm, maxKnownKm);
}
