import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { DashboardSearchParams } from "@/lib/company-scope";
import { getAyDateRange, getSelectedAy, getSelectedDisFirmaId, getSelectedSirketId, getSelectedYil } from "@/lib/company-scope";
import { canAccessAllCompanies, getCurrentUserRole, getModelFilter, getSirketListFilter } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { buildFuelIntervalMetrics } from "@/lib/fuel-metrics";
import KiraliklarClient from "./KiraliklarClient";

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
    const [yakitToplamRows, yakitKayitlari] = aracIds.length
        ? await Promise.all([
            prisma.yakit.groupBy({
                where: {
                    aracId: { in: aracIds },
                    tarih: { gte: rangeStart, lte: rangeEnd },
                },
                by: ["aracId"],
                _sum: { litre: true },
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
        ])
        : [[], []];

    const yakitLitreMap = new Map<string, number>();
    for (const row of yakitToplamRows as Array<{ aracId: string; _sum: { litre: number | null } }>) {
        if (!row?.aracId) continue;
        const litre = Number(row?._sum?.litre || 0);
        yakitLitreMap.set(row.aracId, Number.isFinite(litre) ? litre : 0);
    }

    const yakitMetrigiByAracId = buildFuelIntervalMetrics(
        (yakitKayitlari || []).map((row) => ({
            id: row.id,
            aracId: row.aracId,
            tarih: row.tarih,
            km: row.km,
            litre: Number(row.litre || 0),
            tutar: Number(row.tutar || 0),
            soforId: null,
        }))
    ).byVehicleId;

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
        />
    );
}
