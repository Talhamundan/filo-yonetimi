import { prisma } from "@/lib/prisma";
import { getCurrentUserRole, getModelFilter, getSirketListFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";
import StokTakibiClient from "./client";

export default async function StokTakibiPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const [stokFilter, sirketFilter, role] = await Promise.all([
        getModelFilter("stokKalem", selectedSirketId),
        getSirketListFilter(),
        getCurrentUserRole(),
    ]);

    const sirketListWhere = selectedSirketId ? { id: selectedSirketId } : (sirketFilter as any);
    const [stokKalemleri, sirketler] = await Promise.all([
        (prisma as any).stokKalem
            .findMany({
                where: stokFilter as any,
                include: {
                    sirket: {
                        select: { id: true, ad: true },
                    },
                },
                orderBy: [{ ad: "asc" }, { guncellemeTarihi: "desc" }],
            })
            .catch((error: unknown) => {
                console.warn("Stok kalemleri okunamadı, boş liste döndürülüyor.", error);
                return [];
            }),
        (prisma as any).sirket
            .findMany({
                where: sirketListWhere,
                select: { id: true, ad: true },
                orderBy: { ad: "asc" },
            })
            .catch(() => []),
    ]);
    const selectedScopeSirketAd =
        selectedSirketId && Array.isArray(sirketler)
            ? ((sirketler as Array<{ id: string; ad: string }>).find((item) => item.id === selectedSirketId)?.ad || null)
            : null;

    const rows = (stokKalemleri as any[]).map((item) => ({
        id: item.id,
        ad: item.ad,
        kategori: item.kategori || null,
        miktar: Number(item.miktar || 0),
        birim: item.birim || "ADET",
        konum: item.konum || null,
        kritikSeviye: typeof item.kritikSeviye === "number" ? item.kritikSeviye : null,
        aciklama: item.aciklama || null,
        sirketId: item.sirketId || null,
        sirketAd: item.sirket?.ad || null,
        olusturmaTarihi: item.olusturmaTarihi,
        guncellemeTarihi: item.guncellemeTarihi,
    }));

    return (
        <StokTakibiClient
            initialRows={rows}
            sirketler={sirketler as Array<{ id: string; ad: string }>}
            canManage={role === "ADMIN" || role === "YETKILI" || role === "TEKNIK"}
            defaultSirketId={selectedSirketId || null}
            selectedScopeSirketId={selectedSirketId || null}
            selectedScopeSirketAd={selectedScopeSirketAd}
        />
    );
}
