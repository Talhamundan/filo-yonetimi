import { prisma } from "@/lib/prisma";
import { getModelFilter } from "@/lib/auth-utils";

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

function addYear(years: Set<number>, value: unknown) {
    if (!(value instanceof Date)) return;
    const year = value.getFullYear();
    if (year >= MIN_YEAR && year <= MAX_YEAR) {
        years.add(year);
    }
}

export async function getAvailableYears(selectedSirketId?: string | null) {
    const years = new Set<number>();

    const [
        yakitFilter,
        masrafFilter,
        bakimFilter,
        arizaFilter,
        muayeneFilter,
        kaskoFilter,
        trafikFilter,
        cezaFilter,
        hgsFilter,
        dokumanFilter,
        zimmetFilter,
    ] = await Promise.all([
        getModelFilter("yakit", selectedSirketId),
        getModelFilter("masraf", selectedSirketId),
        getModelFilter("bakim", selectedSirketId),
        getModelFilter("arizaKaydi", selectedSirketId),
        getModelFilter("muayene", selectedSirketId),
        getModelFilter("kasko", selectedSirketId),
        getModelFilter("trafikSigortasi", selectedSirketId),
        getModelFilter("ceza", selectedSirketId),
        getModelFilter("hgs", selectedSirketId),
        getModelFilter("dokuman", selectedSirketId),
        getModelFilter("kullaniciZimmet", selectedSirketId),
    ]);

    const arizaKaydiModel = (prisma as any).arizaKaydi;
    if (!arizaKaydiModel) {
        console.warn("Prisma client üzerinde arizaKaydi modeli bulunamadı. scope-years arıza yıllarını atlayacak.");
    }

    const [
        yakitRows,
        masrafRows,
        bakimRows,
        arizaRows,
        muayeneRows,
        kaskoRows,
        trafikRows,
        cezaRows,
        hgsRows,
        dokumanRows,
        zimmetRows,
    ] = await Promise.all([
        (prisma as any).yakit.findMany({ where: yakitFilter as any, select: { tarih: true } }).catch(() => []),
        (prisma as any).masraf.findMany({ where: masrafFilter as any, select: { tarih: true } }).catch(() => []),
        (prisma as any).bakim.findMany({ where: bakimFilter as any, select: { bakimTarihi: true } }).catch(() => []),
        arizaKaydiModel
            ? arizaKaydiModel.findMany({ where: arizaFilter as any, select: { bildirimTarihi: true } }).catch(() => [])
            : Promise.resolve([]),
        (prisma as any).muayene
            .findMany({ where: muayeneFilter as any, select: { muayeneTarihi: true, gecerlilikTarihi: true } })
            .catch(() => []),
        (prisma as any).kasko
            .findMany({ where: kaskoFilter as any, select: { baslangicTarihi: true, bitisTarihi: true } })
            .catch(() => []),
        (prisma as any).trafikSigortasi
            .findMany({ where: trafikFilter as any, select: { baslangicTarihi: true, bitisTarihi: true } })
            .catch(() => []),
        (prisma as any).ceza
            .findMany({ where: cezaFilter as any, select: { tarih: true, sonOdemeTarihi: true } })
            .catch(() => []),
        (prisma as any).hgsYukleme.findMany({ where: hgsFilter as any, select: { tarih: true } }).catch(() => []),
        (prisma as any).dokuman.findMany({ where: dokumanFilter as any, select: { yuklemeTarihi: true } }).catch(() => []),
        (prisma as any).kullaniciZimmet
            .findMany({ where: zimmetFilter as any, select: { baslangic: true, bitis: true } })
            .catch(() => []),
    ]);

    (yakitRows as Array<{ tarih?: Date | null }>).forEach((row) => addYear(years, row.tarih));
    (masrafRows as Array<{ tarih?: Date | null }>).forEach((row) => addYear(years, row.tarih));
    (bakimRows as Array<{ bakimTarihi?: Date | null }>).forEach((row) => addYear(years, row.bakimTarihi));
    (arizaRows as Array<{ bildirimTarihi?: Date | null }>).forEach((row) => addYear(years, row.bildirimTarihi));
    (muayeneRows as Array<{ muayeneTarihi?: Date | null; gecerlilikTarihi?: Date | null }>).forEach((row) => {
        addYear(years, row.muayeneTarihi);
        addYear(years, row.gecerlilikTarihi);
    });
    (kaskoRows as Array<{ baslangicTarihi?: Date | null; bitisTarihi?: Date | null }>).forEach((row) => {
        addYear(years, row.baslangicTarihi);
        addYear(years, row.bitisTarihi);
    });
    (trafikRows as Array<{ baslangicTarihi?: Date | null; bitisTarihi?: Date | null }>).forEach((row) => {
        addYear(years, row.baslangicTarihi);
        addYear(years, row.bitisTarihi);
    });
    (cezaRows as Array<{ tarih?: Date | null; sonOdemeTarihi?: Date | null }>).forEach((row) => {
        addYear(years, row.tarih);
        addYear(years, row.sonOdemeTarihi);
    });
    (hgsRows as Array<{ tarih?: Date | null }>).forEach((row) => addYear(years, row.tarih));
    (dokumanRows as Array<{ yuklemeTarihi?: Date | null }>).forEach((row) => addYear(years, row.yuklemeTarihi));
    (zimmetRows as Array<{ baslangic?: Date | null; bitis?: Date | null }>).forEach((row) => {
        addYear(years, row.baslangic);
        addYear(years, row.bitis);
    });

    return Array.from(years).sort((a, b) => b - a);
}
