import { prisma } from "../../../../lib/prisma";
import AracDetailClient from "./AracDetailClient";
import { notFound } from "next/navigation";
import { getModelFilter, getCurrentUserRole } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";
import { ensureMuayeneColumns } from "@/lib/muayene-schema-compat";

async function getSafeAracDetail(queryFilter: Record<string, unknown>) {
    const baseArac = await (prisma as any).arac.findFirst({
        where: queryFilter,
        include: {
            sirket: true,
            kullanici: true,
            kullaniciGecmisi: {
                include: { kullanici: true },
                orderBy: { baslangic: "desc" },
            },
        },
    }).catch(async (error: unknown) => {
        console.warn("Arac detay temel include sorgusu basarisiz, minimal sorgu ile devam ediliyor.", error);
        return (prisma as any).arac.findFirst({
            where: queryFilter,
            select: {
                id: true,
                plaka: true,
                marka: true,
                model: true,
                yil: true,
                bulunduguIl: true,
                guncelKm: true,
                hgsNo: true,
                durum: true,
                ruhsatSeriNo: true,
                kullaniciId: true,
                sirketId: true,
                olusturmaTarihi: true,
                guncellemeTarihi: true,
            },
        });
    });

    if (!baseArac?.id) {
        return baseArac;
    }

    const aracId = baseArac.id;

    await ensureMuayeneColumns();

    const muayene = await (prisma as any).muayene.findMany({
        where: { aracId },
        orderBy: [{ aktifMi: "desc" }, { muayeneTarihi: "desc" }, { gecerlilikTarihi: "desc" }],
    }).catch(async (error: unknown) => {
        console.warn("Arac detay muayene sorgusu (muayeneTarihi) basarisiz, fallback deneniyor.", error);
        return (prisma as any).muayene.findMany({
            where: { aracId },
            orderBy: { gecerlilikTarihi: "desc" },
            select: {
                id: true,
                muayeneTarihi: true,
                gecerlilikTarihi: true,
                aktifMi: true,
                aracId: true,
                km: true,
            },
        }).catch((fallbackError: unknown) => {
            console.warn("Arac detay muayene fallback sorgusu da basarisiz.", fallbackError);
            return [];
        }).then((rows: any[]) => rows.map((row: any) => ({ ...row, tutar: null, gectiMi: true })));
    });

    const [bakimlar, arizalar, kasko, trafikSigortasi, yakitlar, masraflar, cezalar, dokumanlar, hgsYuklemeler] = await Promise.all([
        (prisma as any).bakim.findMany({
            where: { aracId },
            orderBy: { bakimTarihi: "desc" },
        }).catch((error: unknown) => {
            console.warn("Arac detay bakim sorgusu basarisiz.", error);
            return [];
        }),
        (prisma as any).arizaKaydi
            .findMany({
                where: { aracId },
                orderBy: [{ durum: "asc" }, { bildirimTarihi: "desc" }],
                include: {
                    sofor: {
                        select: {
                            id: true,
                            ad: true,
                            soyad: true,
                        },
                    },
                },
            })
            .catch(async (error: unknown) => {
                console.warn("Arac detay ariza sorgusu basarisiz, fallback deneniyor.", error);
                return (prisma as any).arizaKaydi
                    .findMany({
                        where: { aracId },
                        orderBy: [{ durum: "asc" }, { bildirimTarihi: "desc" }],
                    })
                    .catch((fallbackError: unknown) => {
                        console.warn("Arac detay ariza fallback sorgusu da basarisiz.", fallbackError);
                        return [];
                    });
            }),
        (prisma as any).kasko.findMany({
            where: { aracId },
            orderBy: [{ aktifMi: "desc" }, { bitisTarihi: "desc" }],
        }).catch((error: unknown) => {
            console.warn("Arac detay kasko sorgusu basarisiz.", error);
            return [];
        }),
        (prisma as any).trafikSigortasi.findMany({
            where: { aracId },
            orderBy: [{ aktifMi: "desc" }, { bitisTarihi: "desc" }],
        }).catch((error: unknown) => {
            console.warn("Arac detay trafik sigortasi sorgusu basarisiz.", error);
            return [];
        }),
        (prisma as any).yakit.findMany({
            where: { aracId },
            orderBy: { tarih: "desc" },
        }).catch((error: unknown) => {
            console.warn("Arac detay yakit sorgusu basarisiz.", error);
            return [];
        }),
        (prisma as any).masraf.findMany({
            where: { aracId },
            orderBy: { tarih: "desc" },
        }).catch((error: unknown) => {
            console.warn("Arac detay masraf sorgusu basarisiz.", error);
            return [];
        }),
        (prisma as any).ceza.findMany({
            where: { aracId },
            orderBy: [{ odendiMi: "asc" }, { sonOdemeTarihi: "asc" }, { tarih: "desc" }],
            include: {
                kullanici: {
                    select: {
                        id: true,
                        ad: true,
                        soyad: true,
                    },
                },
            },
        }).catch((error: unknown) => {
            console.warn("Arac detay ceza sorgusu basarisiz.", error);
            return [];
        }),
        (prisma as any).dokuman.findMany({
            where: { aracId },
            orderBy: { yuklemeTarihi: "desc" },
        }).catch((error: unknown) => {
            console.warn("Arac detay dokuman sorgusu basarisiz.", error);
            return [];
        }),
        (prisma as any).hgsYukleme.findMany({
            where: { aracId },
            orderBy: { tarih: "desc" },
        }).catch((error: unknown) => {
            console.warn("Arac detay hgs yukleme sorgusu basarisiz.", error);
            return [];
        }),
    ]);

    return {
        ...baseArac,
        muayene,
        bakimlar,
        arizalar,
        kasko,
        trafikSigortasi,
        yakitlar,
        masraflar,
        cezalar,
        dokumanlar,
        hgsYuklemeler,
    };
}

async function getSafeAracDetailLegacy(queryFilter: Record<string, unknown>) {
    return await (prisma as any).arac.findFirst({
        where: queryFilter,
        select: {
            id: true,
            plaka: true,
            marka: true,
            model: true,
            yil: true,
            bulunduguIl: true,
            guncelKm: true,
            hgsNo: true,
            durum: true,
            ruhsatSeriNo: true,
            kullaniciId: true,
            sirketId: true,
        },
    });
}

export default async function AracDetailPage(props: { params: Promise<{ id: string }>; searchParams?: Promise<DashboardSearchParams> }) {
    const params = await props.params;
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const [filter, kullaniciFilter, rol] = await Promise.all([
        getModelFilter("arac", selectedSirketId),
        getModelFilter("kullanici", selectedSirketId),
        getCurrentUserRole()
    ]);
    const queryFilter = { id: params.id, ...(filter as any) };

    const [aracRaw, kullanicilar] = await Promise.all([
        getSafeAracDetail(queryFilter).catch(async (error) => {
            console.warn("Arac detay birlesik sorgu basarisiz, legacy minimal sorgu ile devam ediliyor.", error);
            return getSafeAracDetailLegacy(queryFilter);
        }),
        rol === "SOFOR"
            ? []
            : (prisma as any).kullanici.findMany({
                where: kullaniciFilter as any,
                select: { id: true, ad: true, soyad: true },
                orderBy: { ad: "asc" }
            }).catch((error: unknown) => {
                console.warn("Sofor listesi getirilemedi, bos liste ile devam ediliyor.", error);
                return [];
            })
    ]);

    if (!aracRaw) {
        notFound();
    }

    const arac = {
        ...aracRaw,
        sirket: (aracRaw as any).sirket || null,
        kullanici: (aracRaw as any).kullanici || null,
        kullaniciGecmisi: (aracRaw as any).kullaniciGecmisi || [],
        muayene: (aracRaw as any).muayene || [],
        bakimlar: (aracRaw as any).bakimlar || [],
        arizalar: (aracRaw as any).arizalar || [],
        kasko: (aracRaw as any).kasko || [],
        trafikSigortasi: (aracRaw as any).trafikSigortasi || [],
        yakitlar: (aracRaw as any).yakitlar || [],
        masraflar: (aracRaw as any).masraflar || [],
        cezalar: (aracRaw as any).cezalar || [],
        dokumanlar: (aracRaw as any).dokumanlar || [],
        hgsYuklemeler: (aracRaw as any).hgsYuklemeler || [],
    };

    return (
        <AracDetailClient
            initialArac={arac as any}
            kullanicilar={kullanicilar.map((u: any) => ({ id: u.id, adSoyad: `${u.ad} ${u.soyad}` }))}
        />
    );
}
