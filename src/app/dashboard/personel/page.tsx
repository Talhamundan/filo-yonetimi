import React from "react";
import { prisma } from "@/lib/prisma";
import PersonelClient from "./Client";
import { getCurrentUserRole, getModelFilter, getSirketListFilter } from "@/lib/auth-utils";
import { getAyDateRange, getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters } from "@/lib/list-filters";
import { buildFuelIntervalMetrics } from "@/lib/fuel-metrics";

const PERSONEL_ROLE_FILTER_MAP: Record<string, "ADMIN" | "YETKILI" | "SOFOR" | "TEKNIK"> = {
    ADMIN: "ADMIN",
    YETKILI: "YETKILI",
    SOFOR: "SOFOR",
    TEKNIK: "TEKNIK",
    YONETICI: "YETKILI",
    MUDUR: "YETKILI",
    MUHASEBECI: "YETKILI",
};

function toNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function findDriverAtDate(
    zimmetByAracId: Record<string, Array<{ kullaniciId: string; baslangic: number; bitis: number | null }>>,
    aracId: string,
    date: Date
) {
    const rows = zimmetByAracId[aracId];
    if (!rows?.length) return null;
    const target = date.getTime();

    for (let i = rows.length - 1; i >= 0; i -= 1) {
        const row = rows[i];
        if (row.baslangic <= target && (row.bitis === null || row.bitis >= target)) {
            return row.kullaniciId;
        }
    }

    return null;
}

export default async function PersonelPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, selectedAy, commonFilters, role] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getSelectedAy(props.searchParams),
        getCommonListFilters(props.searchParams),
        getCurrentUserRole(),
    ]);
    const { start: rangeStart, end: rangeEnd } = getAyDateRange(selectedYil, selectedAy);

    const [filter, sirketListFilter, cezaFilter, yakitFilter, bakimFilter, zimmetFilter] = await Promise.all([
        getModelFilter('personel', selectedSirketId),
        getSirketListFilter(),
        getModelFilter("ceza", selectedSirketId),
        getModelFilter("yakit", selectedSirketId),
        getModelFilter("bakim", selectedSirketId),
        getModelFilter("kullaniciZimmet", selectedSirketId),
    ]);
    const personelWhereParts: Record<string, unknown>[] = [((filter || {}) as Record<string, unknown>)];

    if (commonFilters.q) {
        const q = commonFilters.q;
        personelWhereParts.push({
            OR: [
                { ad: { contains: q, mode: "insensitive" } },
                { soyad: { contains: q, mode: "insensitive" } },
                { hesap: { is: { kullaniciAdi: { contains: q, mode: "insensitive" } } } },
                { telefon: { contains: q, mode: "insensitive" } },
                { tcNo: { contains: q, mode: "insensitive" } },
            ],
        });
    }
    if (commonFilters.status) {
        const normalizedRoleStatus = PERSONEL_ROLE_FILTER_MAP[commonFilters.status];
        if (normalizedRoleStatus) {
            personelWhereParts.push({ rol: normalizedRoleStatus });
        }
    }
    const personelWhere = personelWhereParts.length > 1 ? { AND: personelWhereParts } : personelWhereParts[0];

    const [personeller, sirketler, cezaBySofor, yakitKayitlari, arizaKayitlari, tumZimmetler] = await Promise.all([
        (prisma as any).kullanici.findMany({
            where: personelWhere as any,
            orderBy: { ad: 'asc' },
            include: { 
                sirket: true,
                hesap: { select: { kullaniciAdi: true } },
                arac: { select: { id: true, plaka: true, marka: true, model: true } }
            }
        }),
        (prisma as any).sirket.findMany({ 
            where: sirketListFilter as any,
            select: { id: true, ad: true, bulunduguIl: true },
            orderBy: { ad: 'asc' }
        }),
        (prisma as any).ceza.groupBy({
            where: { ...(cezaFilter as any), tarih: { gte: rangeStart, lte: rangeEnd } },
            by: ["soforId"],
            _sum: { tutar: true },
        }).catch(() => []),
        (prisma as any).yakit.findMany({
            where: { ...(yakitFilter as any), tarih: { gte: rangeStart, lte: rangeEnd } },
            select: { id: true, aracId: true, tarih: true, tutar: true, litre: true, km: true, soforId: true },
        }).catch(async () => {
            const fallbackRows = await (prisma as any).yakit.findMany({
                where: { ...(yakitFilter as any), tarih: { gte: rangeStart, lte: rangeEnd } },
                select: { id: true, aracId: true, tarih: true, tutar: true, litre: true, km: true },
            }).catch(() => []);
            return (fallbackRows || []).map((row: any) => ({ ...row, soforId: null }));
        }),
        (prisma as any).bakim.findMany({
            where: {
                ...(bakimFilter as any),
                bakimTarihi: { gte: rangeStart, lte: rangeEnd },
                tur: "ARIZA",
            },
            select: { aracId: true, bakimTarihi: true, tutar: true },
        }).catch(() => []),
        (prisma as any).kullaniciZimmet.findMany({
            where: {
                ...(zimmetFilter as any),
                baslangic: { lte: rangeEnd },
                OR: [{ bitis: null }, { bitis: { gte: rangeStart } }],
            },
            select: { aracId: true, kullaniciId: true, baslangic: true, bitis: true },
        }).catch(() => []),
    ]);

    const zimmetByAracId: Record<
        string,
        Array<{ kullaniciId: string; baslangic: number; bitis: number | null }>
    > = {};
    for (const z of tumZimmetler as Array<{ aracId: string; kullaniciId: string; baslangic: Date; bitis: Date | null }>) {
        if (!zimmetByAracId[z.aracId]) {
            zimmetByAracId[z.aracId] = [];
        }
        zimmetByAracId[z.aracId].push({
            kullaniciId: z.kullaniciId,
            baslangic: z.baslangic.getTime(),
            bitis: z.bitis ? z.bitis.getTime() : null,
        });
    }
    Object.values(zimmetByAracId).forEach((list) => {
        list.sort((a, b) => a.baslangic - b.baslangic);
    });

    const costByPersonelId = new Map<string, { ceza: number; yakit: number; ariza: number; toplam: number }>();
    const upsertCost = (kullaniciId: string | null, patch: Partial<{ ceza: number; yakit: number; ariza: number; toplam: number }>) => {
        if (!kullaniciId) return;
        const current = costByPersonelId.get(kullaniciId) || { ceza: 0, yakit: 0, ariza: 0, toplam: 0 };
        const next = {
            ceza: current.ceza + toNumber(patch.ceza),
            yakit: current.yakit + toNumber(patch.yakit),
            ariza: current.ariza + toNumber(patch.ariza),
            toplam: current.toplam + toNumber(patch.toplam),
        };
        costByPersonelId.set(kullaniciId, next);
    };

    for (const ceza of cezaBySofor as Array<{ soforId: string | null; _sum: { tutar: number | null } }>) {
        const tutar = toNumber(ceza?._sum?.tutar);
        upsertCost(ceza.soforId, { ceza: tutar, toplam: tutar });
    }

    for (const yakit of yakitKayitlari as Array<{ aracId: string; tarih: Date; tutar: number; soforId: string | null }>) {
        const soforId = yakit.soforId || findDriverAtDate(zimmetByAracId, yakit.aracId, yakit.tarih);
        const tutar = toNumber(yakit.tutar);
        upsertCost(soforId, { yakit: tutar, toplam: tutar });
    }

    for (const ariza of arizaKayitlari as Array<{ aracId: string; bakimTarihi: Date; tutar: number }>) {
        const soforId = findDriverAtDate(zimmetByAracId, ariza.aracId, ariza.bakimTarihi);
        const tutar = toNumber(ariza.tutar);
        upsertCost(soforId, { ariza: tutar, toplam: tutar });
    }

    const fuelMetricsByDriverId = buildFuelIntervalMetrics(
        (yakitKayitlari as Array<{
            id: string;
            aracId: string;
            tarih: Date;
            tutar: number;
            litre: number;
            km: number;
            soforId: string | null;
        }>).map((yakit) => ({
            id: yakit.id,
            aracId: yakit.aracId,
            tarih: yakit.tarih,
            km: yakit.km,
            litre: yakit.litre,
            tutar: yakit.tutar,
            soforId: yakit.soforId || findDriverAtDate(zimmetByAracId, yakit.aracId, yakit.tarih),
        }))
    ).byDriverId;

    const formattedData = personeller.map((p: any) => {
        const maliyet = costByPersonelId.get(p.id) || { ceza: 0, yakit: 0, ariza: 0, toplam: 0 };
        const yakitOrtalama = fuelMetricsByDriverId.get(p.id);
        return {
            id: p.id,
            adSoyad: `${p.ad} ${p.soyad}`,
            tcNo: p.tcNo || "-",
            telefon: p.telefon || "-",
            girisAdi: p.hesap?.kullaniciAdi || "-",
            rol: p.rol,
            sirketAdi: p.sirket?.ad || "Bağımsız",
            sirketId: p.sirketId || "",
            sehir: p.sehir || "-",
            zimmetliArac: p.arac ? `${p.arac.plaka} (${p.arac.marka} ${p.arac.model})` : null,
            zimmetliAracId: p.arac?.id || null,
            maliyetKalemleri: {
                ceza: maliyet.ceza,
                yakit: maliyet.yakit,
                ariza: maliyet.ariza,
            },
            toplamMaliyet: maliyet.toplam,
            ortalamaYakit100Km: yakitOrtalama?.averageLitresPer100Km ?? null,
            ortalamaYakitKmBasiMaliyet: yakitOrtalama?.averageCostPerKm ?? null,
            ortalamaYakitIntervalSayisi: yakitOrtalama?.intervalCount ?? 0,
        };
    });

    return <PersonelClient initialData={formattedData} sirketler={sirketler} isTeknik={role === "TEKNIK"} />;
}
