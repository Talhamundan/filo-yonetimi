import { prisma } from "@/lib/prisma";
import ArizalarClient from "./client";
import { ArizaRow } from "./columns";
import { getModelFilter, getPersonnelSelectFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";
import { buildTokenizedOrWhere } from "@/lib/search-query";
import { getActivePersonelId } from "@/lib/personel-display";

export default async function ArizalarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);

    const [filter, aracFilter, personelFilter] = await Promise.all([
        getModelFilter("arizaKaydi", selectedSirketId),
        getModelFilter("arac", selectedSirketId),
        getPersonnelSelectFilter(),
    ]);

    const yearWhere = withYilDateFilter((filter || {}) as Record<string, unknown>, "bildirimTarihi", selectedYil);
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
    const whereParts: Record<string, unknown>[] = [yearWhere as Record<string, unknown>];

    const qFilter = buildTokenizedOrWhere(commonFilters.q, (token) => [
        { aciklama: { contains: token, mode: "insensitive" } },
        { servisAdi: { contains: token, mode: "insensitive" } },
        { yapilanIslemler: { contains: token, mode: "insensitive" } },
        { arac: { plaka: { contains: token, mode: "insensitive" } } },
        { arac: { marka: { contains: token, mode: "insensitive" } } },
        { arac: { model: { contains: token, mode: "insensitive" } } },
    ]);
    if (qFilter) {
        whereParts.push(qFilter);
    }
    if (commonFilters.status) {
        whereParts.push({ durum: commonFilters.status });
    }
    if (commonFilters.type) {
        if (commonFilters.type === "YUKSEK" || commonFilters.type === "KRITIK") {
            whereParts.push({ oncelik: { in: ["YUKSEK", "KRITIK"] } });
        } else {
            whereParts.push({ oncelik: commonFilters.type });
        }
    }
    if (dateRange) {
        whereParts.push({ bildirimTarihi: dateRange });
    }
    const scopedWhere = whereParts.length > 1 ? { AND: whereParts } : whereParts[0];

    const arizaKaydiModel = (prisma as any).arizaKaydi;
    const rowsPromise = arizaKaydiModel
        ? arizaKaydiModel
              .findMany({
                  where: scopedWhere as any,
                  orderBy: [{ durum: "asc" }, { bildirimTarihi: "desc" }],
                  include: {
                      arac: {
                          include: {
                              sirket: { select: { ad: true } },
                          },
                      },
                      sofor: {
                          select: {
                              id: true,
                              ad: true,
                              soyad: true,
                          },
                      },
                  },
              })
              .catch(async (error: any) => {
                  console.warn("Arıza kayıtları okunamadı.", error);
                  return arizaKaydiModel
                      .findMany({
                          where: scopedWhere as any,
                          orderBy: [{ durum: "asc" }, { bildirimTarihi: "desc" }],
                          include: {
                              arac: {
                                  include: {
                                      sirket: { select: { ad: true } },
                                  },
                              },
                          },
                      })
                      .catch((fallbackError: any) => {
                          console.warn("Arıza kayıtları fallback sorgusu da okunamadı.", fallbackError);
                          return [];
                      });
              })
        : Promise.resolve([]);

    if (!arizaKaydiModel) {
        console.warn("Prisma client üzerinde arizaKaydi modeli bulunamadı. Prisma generate/migrate gerekli olabilir.");
    }

    const [rows, araclar, personeller] = await Promise.all([
        rowsPromise,
        (prisma as any).arac.findMany({
            where: aracFilter as any,
            select: {
                id: true,
                plaka: true,
                marka: true,
                model: true,
                bulunduguIl: true,
                guncelKm: true,
                durum: true,
                kullaniciId: true,
                kullanici: {
                    select: {
                        id: true,
                        ad: true,
                        soyad: true,
                    },
                },
                kullaniciGecmisi: {
                    where: { bitis: null },
                    orderBy: { baslangic: "desc" },
                    take: 1,
                    select: {
                        kullanici: {
                            select: {
                                id: true,
                                ad: true,
                                soyad: true,
                            },
                        },
                    },
                },
            },
            orderBy: { plaka: "asc" },
        }).catch((error: any) => {
            console.warn("Araç listesi okunamadı.", error);
            return [];
        }),
        (prisma as any).kullanici
            .findMany({
                where: {
                    ...(personelFilter as any),
                    rol: { not: "ADMIN" },
                },
                select: {
                    id: true,
                    ad: true,
                    soyad: true,
                    rol: true,
                },
                orderBy: [{ ad: "asc" }, { soyad: "asc" }],
            })
            .catch((error: any) => {
                console.warn("Personel listesi okunamadı.", error);
                return [];
            }),
    ]);
    const aracOptions = (araclar as any[]).map((arac) => {
        const aktifSofor = arac.kullaniciGecmisi?.[0]?.kullanici || arac.kullanici || null;
        return {
            ...arac,
            aktifSoforId: getActivePersonelId(aktifSofor),
            aktifSofor: aktifSofor || null,
        };
    });

    return (
        <ArizalarClient
            initialData={rows as unknown as ArizaRow[]}
            araclar={aracOptions as any[]}
            personeller={personeller as any[]}
        />
    );
}
