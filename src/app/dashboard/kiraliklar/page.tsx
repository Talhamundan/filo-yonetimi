import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { DashboardSearchParams } from "@/lib/company-scope";
import { getSelectedSirketId } from "@/lib/company-scope";
import { canAccessAllCompanies, getCurrentUserRole, getModelFilter, getSirketListFilter } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import KiraliklarClient from "./KiraliklarClient";

export default async function KiraliklarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [role, hasGlobalCompanyAccess] = await Promise.all([getCurrentUserRole(), canAccessAllCompanies()]);
    const canManageVendors = role === "ADMIN" || (role === "YETKILI" && hasGlobalCompanyAccess);
    if (!canManageVendors) redirect("/dashboard");

    const selectedSirketId = await getSelectedSirketId(props.searchParams);
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
