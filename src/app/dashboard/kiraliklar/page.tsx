import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { DashboardSearchParams } from "@/lib/company-scope";
import { getAyDateRange, getSelectedAy, getSelectedDisFirmaId, getSelectedSirketId, getSelectedYil } from "@/lib/company-scope";
import { canAccessAllCompanies, getCurrentUserRole, getModelFilter, getSirketListFilter } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { buildFuelIntervalMetrics, getFuelConsumptionUnitByAltKategori } from "@/lib/fuel-metrics";
import KiraliklarClient from "./KiraliklarClient";
import type { YakitRow } from "../yakitlar/columns";

function toNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export default async function KiraliklarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [role, hasGlobalCompanyAccess] = await Promise.all([getCurrentUserRole(), canAccessAllCompanies()]);
    const canManageVendors = role === "ADMIN" || (role === "YETKILI" && hasGlobalCompanyAccess);
    if (!canManageVendors) redirect("/dashboard");

    const resolvedSearchParams = props.searchParams ? await props.searchParams : {};
    const [selectedSirketId, selectedYil, selectedAy, selectedDisFirmaId] = await Promise.all([
        getSelectedSirketId(resolvedSearchParams),
        getSelectedYil(resolvedSearchParams),
        getSelectedAy(resolvedSearchParams),
        getSelectedDisFirmaId(resolvedSearchParams),
    ]);
    const { start: rangeStart, end: rangeEnd } = getAyDateRange(selectedYil, selectedAy);

    const [aracFilter, personelFilter, sirketListFilter] = await Promise.all([
        getModelFilter("arac", selectedSirketId),
        getModelFilter("personel", selectedSirketId),
        getSirketListFilter(),
    ]);

    const [sirketler, disFirmalar, araclar, personeller] = await Promise.all([
        prisma.sirket.findMany({
            where: sirketListFilter as Prisma.SirketWhereInput,
            select: { id: true, ad: true },
            orderBy: { ad: "asc" },
        }),
        prisma.disFirma.findMany({
            where: { tur: { in: ["KIRALIK", "TASERON"] } },
            select: { id: true, ad: true, tur: true },
            orderBy: { ad: "asc" },
        }),
        prisma.arac.findMany({
            where: {
                AND: [
                    aracFilter as Prisma.AracWhereInput,
                    { disFirma: { is: { tur: { in: ["KIRALIK", "TASERON"] } } } },
                    ...(selectedDisFirmaId ? [{ disFirmaId: selectedDisFirmaId }] : []),
                ],
            },
            select: {
                id: true,
                plaka: true,
                sirketId: true,
                disFirmaId: true,
                kullaniciId: true,
                altKategori: true,
                sirket: { select: { id: true, ad: true } },
                disFirma: { select: { id: true, ad: true, tur: true } },
                kullanici: { select: { id: true, ad: true, soyad: true } },
            },
            orderBy: { plaka: "asc" },
        }),
        prisma.kullanici.findMany({
            where: {
                AND: [
                    personelFilter as Prisma.KullaniciWhereInput,
                    { disFirma: { is: { tur: { in: ["KIRALIK", "TASERON"] } } } },
                    ...(selectedDisFirmaId ? [{ disFirmaId: selectedDisFirmaId }] : []),
                ],
            },
            select: {
                id: true,
                ad: true,
                soyad: true,
                telefon: true,
                sirketId: true,
                disFirmaId: true,
                sirket: { select: { id: true, ad: true } },
                disFirma: { select: { id: true, ad: true, tur: true } },
                arac: { select: { plaka: true } },
            },
            orderBy: [{ ad: "asc" }, { soyad: "asc" }],
        }),
    ]);

    const aracIds = araclar.map((arac) => arac.id).filter(Boolean);
    const [yakitToplamRows, yakitKayitlari, bakimToplamRows, masrafToplamRows, cezaToplamRows, kiralikYakitRows] = aracIds.length
        ? await Promise.all([
            prisma.yakit.groupBy({
                where: {
                    aracId: { in: aracIds },
                    tarih: { gte: rangeStart, lte: rangeEnd },
                },
                by: ["aracId"],
                _sum: { litre: true, tutar: true },
            }),
            prisma.yakit.findMany({
                where: {
                    aracId: { in: aracIds },
                    tarih: { gte: rangeStart, lte: rangeEnd },
                },
                select: {
                    id: true,
                    aracId: true,
                    tarih: true,
                    km: true,
                    litre: true,
                    tutar: true,
                },
                orderBy: [{ aracId: "asc" }, { tarih: "asc" }, { km: "asc" }],
            }),
            prisma.bakim.groupBy({
                where: {
                    aracId: { in: aracIds },
                    bakimTarihi: { gte: rangeStart, lte: rangeEnd },
                    deletedAt: null,
                },
                by: ["aracId"],
                _sum: { tutar: true },
            }),
            prisma.masraf.groupBy({
                where: {
                    aracId: { in: aracIds },
                    tarih: { gte: rangeStart, lte: rangeEnd },
                    deletedAt: null,
                    tur: { not: "YAKIT" as any },
                },
                by: ["aracId"],
                _sum: { tutar: true },
            }),
            prisma.ceza.groupBy({
                where: {
                    aracId: { in: aracIds },
                    tarih: { gte: rangeStart, lte: rangeEnd },
                    deletedAt: null,
                },
                by: ["aracId"],
                _sum: { tutar: true },
            }),
            prisma.yakit.findMany({
                where: {
                    aracId: { in: aracIds },
                    tarih: { gte: rangeStart, lte: rangeEnd },
                },
                orderBy: { tarih: "desc" },
                include: {
                    sofor: {
                        select: {
                            id: true,
                            ad: true,
                            soyad: true,
                            deletedAt: true,
                            calistigiKurum: true,
                            sirket: { select: { ad: true } },
                        },
                    },
                    arac: {
                        select: {
                            id: true,
                            plaka: true,
                            marka: true,
                            model: true,
                            altKategori: true,
                            calistigiKurum: true,
                            sirket: { select: { ad: true } },
                            kullanici: {
                                select: {
                                    id: true,
                                    ad: true,
                                    soyad: true,
                                    deletedAt: true,
                                },
                            },
                        },
                    },
                },
            }),
        ])
        : [[], [], [], [], [], []];

    const yakitLitreMap = new Map<string, number>();
    const yakitTutarMap = new Map<string, number>();
    for (const row of yakitToplamRows as Array<{ aracId: string; _sum: { litre: number | null; tutar: number | null } }>) {
        if (!row?.aracId) continue;
        const litre = Number(row?._sum?.litre || 0);
        const tutar = Number(row?._sum?.tutar || 0);
        yakitLitreMap.set(row.aracId, Number.isFinite(litre) ? litre : 0);
        yakitTutarMap.set(row.aracId, Number.isFinite(tutar) ? tutar : 0);
    }

    const bakimTutarMap = new Map<string, number>();
    for (const row of bakimToplamRows as Array<{ aracId: string; _sum: { tutar: number | null } }>) {
        if (!row?.aracId) continue;
        bakimTutarMap.set(row.aracId, toNumber(row?._sum?.tutar));
    }

    const masrafTutarMap = new Map<string, number>();
    for (const row of masrafToplamRows as Array<{ aracId: string; _sum: { tutar: number | null } }>) {
        if (!row?.aracId) continue;
        masrafTutarMap.set(row.aracId, toNumber(row?._sum?.tutar));
    }

    const cezaTutarMap = new Map<string, number>();
    for (const row of cezaToplamRows as Array<{ aracId: string; _sum: { tutar: number | null } }>) {
        if (!row?.aracId) continue;
        cezaTutarMap.set(row.aracId, toNumber(row?._sum?.tutar));
    }

    const consumptionUnitByAracId = new Map<string, "LITRE_PER_100_KM" | "LITRE_PER_HOUR">();
    for (const arac of araclar) {
        if (!arac?.id) continue;
        consumptionUnitByAracId.set(arac.id, getFuelConsumptionUnitByAltKategori(arac.altKategori));
    }

    const yakitMetrikleri = buildFuelIntervalMetrics(
        (yakitKayitlari || []).map((row) => ({
            id: row.id,
            aracId: row.aracId,
            tarih: row.tarih,
            km: row.km,
            litre: Number(row.litre || 0),
            tutar: Number(row.tutar || 0),
            soforId: null,
            consumptionUnit: consumptionUnitByAracId.get(row.aracId) || "LITRE_PER_100_KM",
        }))
    );
    const yakitMetrigiByAracId = yakitMetrikleri.byVehicleId;
    const yakitAralikMetrigiByRecordId = yakitMetrikleri.byCurrentRecordId;

    const miniDashboardRows = araclar.map((arac) => {
        const yakitLitre = toNumber(yakitLitreMap.get(arac.id));
        const yakitTutar = toNumber(yakitTutarMap.get(arac.id));
        const bakimTutar = toNumber(bakimTutarMap.get(arac.id));
        const masrafTutar = toNumber(masrafTutarMap.get(arac.id));
        const cezaTutar = toNumber(cezaTutarMap.get(arac.id));
        const toplamTutar = yakitTutar + bakimTutar + masrafTutar + cezaTutar;

        return {
            aracId: arac.id,
            plaka: arac.plaka || "-",
            disFirmaId: arac.disFirmaId || "",
            disFirmaAd: arac.disFirma?.ad || "Bilinmeyen Dış Firma",
            yakitLitre,
            yakitTutar,
            bakimTutar,
            masrafTutar,
            cezaTutar,
            toplamTutar,
        };
    });

    const toplamYakitLitre = miniDashboardRows.reduce((sum, row) => sum + row.yakitLitre, 0);
    const toplamYakitTutari = miniDashboardRows.reduce((sum, row) => sum + row.yakitTutar, 0);
    const toplamBakimTutari = miniDashboardRows.reduce((sum, row) => sum + row.bakimTutar, 0);
    const toplamMasrafTutari = miniDashboardRows.reduce((sum, row) => sum + row.masrafTutar, 0);
    const toplamCezaTutari = miniDashboardRows.reduce((sum, row) => sum + row.cezaTutar, 0);
    const toplamGiderTutari = miniDashboardRows.reduce((sum, row) => sum + row.toplamTutar, 0);

    const expenseByDisFirmaMap = new Map<string, { disFirmaAd: string; toplamTutar: number }>();
    for (const row of miniDashboardRows) {
        const key = row.disFirmaId || row.disFirmaAd;
        const current = expenseByDisFirmaMap.get(key) || { disFirmaAd: row.disFirmaAd, toplamTutar: 0 };
        current.toplamTutar += row.toplamTutar;
        expenseByDisFirmaMap.set(key, current);
    }
    const expenseByDisFirma = [...expenseByDisFirmaMap.values()]
        .sort((a, b) => b.toplamTutar - a.toplamTutar)
        .slice(0, 8);

    const fuelByVehicle = [...miniDashboardRows]
        .filter((row) => row.yakitLitre > 0)
        .sort((a, b) => b.yakitLitre - a.yakitLitre)
        .slice(0, 10)
        .map((row) => ({
            aracId: row.aracId,
            plaka: row.plaka,
            disFirmaAd: row.disFirmaAd,
            yakitLitre: row.yakitLitre,
            yakitTutari: row.yakitTutar,
        }));

    const expenseByVehicle = [...miniDashboardRows]
        .filter((row) => row.toplamTutar > 0)
        .sort((a, b) => b.toplamTutar - a.toplamTutar)
        .slice(0, 10)
        .map((row) => ({
            aracId: row.aracId,
            plaka: row.plaka,
            disFirmaAd: row.disFirmaAd,
            toplamTutar: row.toplamTutar,
            yakitTutar: row.yakitTutar,
            bakimTutar: row.bakimTutar,
            masrafTutar: row.masrafTutar,
            cezaTutar: row.cezaTutar,
        }));

    const kiralikYakitlar: YakitRow[] = (kiralikYakitRows as any[]).map((row) => {
        const metric = yakitAralikMetrigiByRecordId.get(row.id);
        return {
            id: row.id,
            tarih: row.tarih,
            litre: Number(row.litre || 0),
            tutar: Number(row.tutar || 0),
            km: row.km == null ? null : Number(row.km),
            istasyon: row.istasyon || null,
            odemeYontemi: row.odemeYontemi || "NAKIT",
            odendiMi: Boolean(row.odendiMi),
            endeks: row.endeks == null ? null : Number(row.endeks),
            soforId: row.soforId || null,
            sofor: row.sofor
                ? {
                      id: row.sofor.id,
                      ad: row.sofor.ad,
                      soyad: row.sofor.soyad,
                      deletedAt: row.sofor.deletedAt || null,
                      calistigiKurum: row.sofor.calistigiKurum || null,
                      sirket: row.sofor.sirket || null,
                  }
                : null,
            arac: {
                id: row.arac.id,
                plaka: row.arac.plaka || "-",
                marka: row.arac.marka || "-",
                model: row.arac.model || "-",
                altKategori: row.arac.altKategori || null,
                calistigiKurum: row.arac.calistigiKurum || null,
                sirket: row.arac.sirket || null,
                kullanici: row.arac.kullanici || null,
            },
            ortalamaYakit100Km: metric?.averageLitresPer100Km ?? null,
            ortalamaKmBasiMaliyet: metric?.averageCostPerKm ?? null,
            ortalamaYakitDistanceKm: metric?.distanceKm ?? null,
            ortalamaYakitDistanceBirimi: metric?.distanceUnit ?? null,
            yakitTuketimBirimi:
                metric?.consumptionUnit || consumptionUnitByAracId.get(row.arac.id) || "LITRE_PER_100_KM",
        };
    });

    return (
        <KiraliklarClient
            sirketler={sirketler}
            disFirmalar={disFirmalar}
            araclar={araclar.map((arac) => ({
                id: arac.id,
                plaka: arac.plaka || "-",
                sirketId: arac.sirketId || "",
                sirketAd: arac.sirket?.ad || "-",
                disFirmaId: arac.disFirmaId || "",
                disFirmaAd: arac.disFirma ? `${arac.disFirma.ad} (${arac.disFirma.tur === "TASERON" ? "Taşeron" : "Kiralık"})` : "-",
                soforId: arac.kullaniciId || "",
                soforAdSoyad: arac.kullanici ? `${arac.kullanici.ad} ${arac.kullanici.soyad}`.trim() : "-",
                yakitToplamLitre: yakitLitreMap.get(arac.id) || 0,
                ortalamaYakit100Km: yakitMetrigiByAracId.get(arac.id)?.averageLitresPer100Km ?? null,
                ortalamaYakitIntervalSayisi: yakitMetrigiByAracId.get(arac.id)?.intervalCount ?? 0,
                yakitTuketimBirimi:
                    yakitMetrigiByAracId.get(arac.id)?.consumptionUnit ||
                    consumptionUnitByAracId.get(arac.id) ||
                    "LITRE_PER_100_KM",
            }))}
            personeller={personeller.map((personel) => ({
                id: personel.id,
                ad: personel.ad,
                soyad: personel.soyad,
                adSoyad: `${personel.ad} ${personel.soyad}`.trim(),
                telefon: personel.telefon || "-",
                sirketId: personel.sirketId || "",
                sirketAd: personel.sirket?.ad || "-",
                disFirmaId: personel.disFirmaId || "",
                disFirmaAd: personel.disFirma ? `${personel.disFirma.ad} (${personel.disFirma.tur === "TASERON" ? "Taşeron" : "Kiralık"})` : "-",
                zimmetliArac: personel.arac?.plaka || "-",
            }))}
            miniDashboard={{
                selectedYil,
                selectedAy,
                toplamArac: araclar.length,
                toplamPersonel: personeller.length,
                toplamYakitLitre,
                toplamYakitTutari,
                toplamBakimTutari,
                toplamMasrafTutari,
                toplamCezaTutari,
                toplamGiderTutari,
                fuelByVehicle,
                expenseByVehicle,
                expenseByDisFirma,
            }}
            kiralikYakitlar={kiralikYakitlar}
        />
    );
}
