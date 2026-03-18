import { prisma } from "@/lib/prisma";
import CezaMasraflariClient from "./client";
import { CezaMasrafRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";

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
                kullanici: { select: { id: true, ad: true, soyad: true } },
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
    const [selectedSirketId, selectedYil] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
    ]);
    const [cezaFilter, aracFilter, kullaniciFilter] = await Promise.all([
        getModelFilter("ceza", selectedSirketId),
        getModelFilter("arac", selectedSirketId),
        getModelFilter("kullanici", selectedSirketId),
    ]);
    const cezaWhere = withYilDateFilter((cezaFilter || {}) as Record<string, unknown>, "tarih", selectedYil);

    const [cezalarRaw, araclarRaw, soforlerRaw] = await Promise.all([
        getSafeCezalar(cezaWhere as any),
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
                        select: { id: true, ad: true, soyad: true },
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
        const sofor = ceza.kullanici || (ceza.soforId ? soforMap.get(ceza.soforId) : null);
        const tarih = ceza.tarih ?? ceza.cezaTarihi ?? null;

        return {
            id: ceza.id,
            aracId: ceza.aracId || arac?.id || "",
            plaka: ceza.plaka || arac?.plaka || "-",
            aracMarka: arac?.marka || "",
            aracModel: arac?.model || "",
            sirketAd: arac?.sirket?.ad || null,
            soforId: ceza.soforId || null,
            soforAdSoyad: sofor ? `${sofor.ad} ${sofor.soyad}` : "-",
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
                aktifSoforId: a.kullanici?.id || null,
                aktifSoforAdSoyad: a.kullanici ? `${a.kullanici.ad} ${a.kullanici.soyad}` : null,
            }))}
            soforler={(soforlerRaw as any[]).map((s: any) => ({ id: s.id, adSoyad: `${s.ad} ${s.soyad}` }))}
        />
    );
}
