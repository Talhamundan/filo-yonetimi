import { prisma } from "@/lib/prisma";
import CezaMasraflariClient from "./client";
import { CezaMasrafRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";
import { ESKI_PERSONEL_ETIKETI, getActivePersonelId, getPersonelDisplayName, isDeletedPersonel } from "@/lib/personel-display";

async function getSafeCezalar(cezaFilter: Record<string, unknown>) {
    try {
        return await (prisma as any).ceza.findMany({
            where: cezaFilter as any,
            orderBy: { tarih: "desc" },
            select: {
                id: true,
                aracId: true,
                soforId: true,
                tarih: true,
                cezaMaddesi: true,
                aciklama: true,
                tutar: true,
                km: true,
                sonOdemeTarihi: true,
                odendiMi: true,
                arac: {
                    select: {
                        id: true,
                        plaka: true,
                        marka: true,
                        model: true,
                        sirket: { select: { ad: true } },
                    },
                },
                kullanici: { select: { id: true, ad: true, soyad: true, deletedAt: true } },
            },
        });
    } catch (error) {
        console.warn("Ceza masraflari gelismis include sorgusu basarisiz, geriye donuk sorgu ile devam ediliyor.", error);
    }

    try {
        return await (prisma as any).ceza.findMany({
            where: cezaFilter as any,
            orderBy: { tarih: "desc" },
            select: {
                id: true,
                aracId: true,
                soforId: true,
                tarih: true,
                aciklama: true,
                tutar: true,
            },
        });
    } catch (error) {
        console.warn("Ceza masraflari geriye donuk sorgusu da basarisiz, bos liste ile devam ediliyor.", error);
        return [];
    }
}

export default async function CezaMasraflariPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const [cezaFilter, aracFilter, kullaniciFilter] = await Promise.all([
        getModelFilter("ceza", selectedSirketId),
        getModelFilter("arac", selectedSirketId),
        getModelFilter("kullanici", selectedSirketId),
    ]);
    const cezaWhere = withYilDateFilter((cezaFilter || {}) as Record<string, unknown>, "tarih", selectedYil);
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const soonDate = new Date(now);
    soonDate.setDate(soonDate.getDate() + 30);
    const whereParts: Record<string, unknown>[] = [cezaWhere as Record<string, unknown>];

    if (commonFilters.q) {
        const q = commonFilters.q;
        whereParts.push({
            OR: [
                { plaka: { contains: q, mode: "insensitive" } },
                { cezaMaddesi: { contains: q, mode: "insensitive" } },
                { aciklama: { contains: q, mode: "insensitive" } },
                { arac: { plaka: { contains: q, mode: "insensitive" } } },
                {
                    kullanici: {
                        OR: [
                            { ad: { contains: q, mode: "insensitive" } },
                            { soyad: { contains: q, mode: "insensitive" } },
                        ],
                    },
                },
            ],
        });
    }
    if (commonFilters.status) {
        switch (commonFilters.status) {
            case "ODENDI":
                whereParts.push({ odendiMi: true });
                break;
            case "ODENMEDI":
                whereParts.push({ odendiMi: false });
                break;
            case "GECIKTI":
                whereParts.push({ odendiMi: false, sonOdemeTarihi: { lt: now } });
                break;
            case "YAKLASIYOR":
                whereParts.push({ odendiMi: false, sonOdemeTarihi: { gte: now, lte: soonDate } });
                break;
            default:
                break;
        }
    }
    if (dateRange) {
        whereParts.push({ tarih: dateRange });
    }
    const scopedCezaWhere = whereParts.length > 1 ? { AND: whereParts } : whereParts[0];

    const [cezalarRaw, araclarRaw, soforlerRaw] = await Promise.all([
        getSafeCezalar(scopedCezaWhere as any),
        (prisma as any).arac
            .findMany({
                where: aracFilter as any,
                select: {
                    id: true,
                    plaka: true,
                    marka: true,
                    model: true,
                    bulunduguIl: true,
                    guncelKm: true,
                    kullanici: {
                        select: { id: true, ad: true, soyad: true, deletedAt: true },
                    },
                    sirket: { select: { ad: true } },
                },
                orderBy: { plaka: "asc" },
            })
            .catch((error: unknown) => {
                console.warn("Ceza masrafi arac listesi getirilemedi, bos liste ile devam ediliyor.", error);
                return [];
            }),
        (prisma as any).kullanici
            .findMany({
                where: { ...(kullaniciFilter as any), rol: "SOFOR" },
                select: { id: true, ad: true, soyad: true },
                orderBy: [{ ad: "asc" }, { soyad: "asc" }],
            })
            .catch((error: unknown) => {
                console.warn("Ceza masrafi sofor listesi getirilemedi, bos liste ile devam ediliyor.", error);
                return [];
            }),
    ]);

    const aracMap = new Map((araclarRaw as any[]).map((a: any) => [a.id, a]));
    const soforMap = new Map((soforlerRaw as any[]).map((s: any) => [s.id, s]));

    const rows: CezaMasrafRow[] = (cezalarRaw as any[]).map((ceza: any) => {
        const arac = ceza.arac || aracMap.get(ceza.aracId);
        const cezaKullanicisi = ceza.kullanici || null;
        const cezaSoforuSilinmis = isDeletedPersonel(cezaKullanicisi);
        const sofor = cezaSoforuSilinmis ? null : (cezaKullanicisi || (ceza.soforId ? soforMap.get(ceza.soforId) : null));
        const hasLegacySoforRef = Boolean(ceza.soforId);
        const tarih = ceza.tarih ?? ceza.cezaTarihi ?? null;
        const soforAdSoyad = sofor
            ? getPersonelDisplayName(sofor)
            : hasLegacySoforRef
                ? ESKI_PERSONEL_ETIKETI
                : "-";

        return {
            id: ceza.id,
            aracId: ceza.aracId || arac?.id || "",
            plaka: ceza.plaka || arac?.plaka || "-",
            aracMarka: arac?.marka || "",
            aracModel: arac?.model || "",
            sirketAd: arac?.sirket?.ad || null,
            soforId: getActivePersonelId(sofor),
            soforAdSoyad,
            tarih,
            sonOdemeTarihi: ceza.sonOdemeTarihi ?? null,
            cezaMaddesi: ceza.cezaMaddesi || "Belirtilmedi",
            aciklama: ceza.aciklama || null,
            tutar: Number(ceza.tutar || 0),
            odendiMi: Boolean(ceza.odendiMi),
            km: ceza.km != null ? Number(ceza.km) : null,
        };
    });

    return (
        <CezaMasraflariClient
            initialData={rows}
            araclar={(araclarRaw as any[]).map((a: any) => ({
                id: a.id,
                plaka: a.plaka,
                marka: a.marka,
                model: a.model,
                bulunduguIl: a.bulunduguIl,
                guncelKm: a.guncelKm,
                aktifSoforId: getActivePersonelId(a.kullanici),
                aktifSoforAdSoyad: a.kullanici ? getPersonelDisplayName(a.kullanici) : null,
            }))}
            soforler={(soforlerRaw as any[]).map((s: any) => ({ id: s.id, adSoyad: `${s.ad} ${s.soyad}` }))}
        />
    );
}
