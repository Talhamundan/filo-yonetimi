import { prisma } from "../../../../lib/prisma";
import AracDetailClient from "./AracDetailClient";
import { notFound } from "next/navigation";
import { getModelFilter, getCurrentUserRole, getPersonnelSelectFilter, getSirketListFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";
import { ensureMuayeneColumns } from "@/lib/muayene-schema-compat";
import { syncAracGuncelKm } from "@/lib/km-consistency";
import { buildFuelIntervalMetrics } from "@/lib/fuel-metrics";

async function getSafeAracDetail(queryFilter: Record<string, unknown>) {
    const baseArac = await (prisma as any).arac.findFirst({
        where: queryFilter,
        include: {
            sirket: true,
            disFirma: true,
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
                aciklama: true,
                durum: true,
                ruhsatSeriNo: true,
                kullaniciId: true,
                sirketId: true,
                disFirmaId: true,
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

    const [bakimlar, arizalar, kasko, trafikSigortasi, yakitlar, masraflar, cezalar, dokumanlar] = await Promise.all([
        (prisma as any).bakim.findMany({
            where: { aracId, deletedAt: null },
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
            include: {
                sofor: {
                    select: {
                        id: true,
                        ad: true,
                        soyad: true,
                        calistigiKurum: true,
                        sirket: {
                            select: {
                                id: true,
                                ad: true,
                            },
                        },
                    },
                },
            },
        }).catch(async (error: unknown) => {
            console.warn("Arac detay yakit sorgusu (sofor include) basarisiz, fallback deneniyor.", error);
            return (prisma as any).yakit.findMany({
                where: { aracId },
                orderBy: { tarih: "desc" },
            }).catch((fallbackError: unknown) => {
                console.warn("Arac detay yakit fallback sorgusu da basarisiz.", fallbackError);
                return [];
            });
        }),
        (prisma as any).masraf.findMany({
            where: { aracId, deletedAt: null },
            orderBy: { tarih: "desc" },
        }).catch((error: unknown) => {
            console.warn("Arac detay masraf sorgusu basarisiz.", error);
            return [];
        }),
        (prisma as any).ceza.findMany({
            where: { aracId, deletedAt: null },
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
            where: { aracId, deletedAt: null },
            orderBy: { yuklemeTarihi: "desc" },
        }).catch((error: unknown) => {
            console.warn("Arac detay dokuman sorgusu basarisiz.", error);
            return [];
        }),
    ]);

    const syncedGuncelKm = await syncAracGuncelKm(aracId).catch((error: unknown) => {
        console.warn("Arac detay guncel km senkronizasyonu basarisiz, mevcut deger korunuyor.", error);
        return Number((baseArac as any)?.guncelKm || 0);
    });

    return {
        ...baseArac,
        guncelKm: Number.isFinite(syncedGuncelKm) ? syncedGuncelKm : Number((baseArac as any)?.guncelKm || 0),
        muayene,
        bakimlar,
        arizalar,
        kasko,
        trafikSigortasi,
        yakitlar,
        masraflar,
        cezalar,
        dokumanlar,
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
            aciklama: true,
            durum: true,
            ruhsatSeriNo: true,
            kullaniciId: true,
            sirketId: true,
            disFirmaId: true,
        },
    });
}

export default async function AracDetailPage(props: { params: Promise<{ id: string }>; searchParams?: Promise<DashboardSearchParams> }) {
    const params = await props.params;
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const [filter, kullaniciFilter, rol, sirketListFilter] = await Promise.all([
        getModelFilter("arac", selectedSirketId),
        getPersonnelSelectFilter(),
        getCurrentUserRole(),
        getSirketListFilter(),
    ]);
    const queryFilter = { id: params.id, ...(filter as any) };

    const [aracRaw, kullanicilar, sirketler, disFirmalar] = await Promise.all([
        getSafeAracDetail(queryFilter).catch(async (error) => {
            console.warn("Arac detay birlesik sorgu basarisiz, legacy minimal sorgu ile devam ediliyor.", error);
            return getSafeAracDetailLegacy(queryFilter);
        }),
        rol === "PERSONEL"
            ? []
            : (prisma as any).kullanici.findMany({
                where: {
                    ...(kullaniciFilter as any),
                    arac: { is: null },
                    zimmetler: {
                        none: {
                            bitis: null,
                        },
                    },
                } as any,
                select: {
                    id: true,
                    ad: true,
                    soyad: true,
                    sirketId: true,
                    sirket: { select: { id: true, ad: true } },
                },
                orderBy: { ad: "asc" }
            }).catch((error: unknown) => {
                console.warn("Sofor listesi getirilemedi, bos liste ile devam ediliyor.", error);
                return [];
            }),
        (prisma as any).sirket.findMany({
            where: sirketListFilter as any,
            select: { id: true, ad: true, bulunduguIl: true },
            orderBy: { ad: "asc" },
        }).catch((error: unknown) => {
            console.warn("Sirket listesi getirilemedi, bos liste ile devam ediliyor.", error);
            return [];
        }),
        (prisma as any).disFirma.findMany({
            select: { id: true, ad: true, tur: true },
            orderBy: { ad: "asc" },
        }).catch(() => []),
    ]);

    if (!aracRaw) {
        notFound();
    }

    const activeZimmet = ((aracRaw as any).kullaniciGecmisi || []).find((z: any) => !z.bitis) || null;
    const inferredKullanici = (aracRaw as any).kullanici || activeZimmet?.kullanici || null;
    const yakitMetric = buildFuelIntervalMetrics(
        ((aracRaw as any).yakitlar || []).map((yakit: any) => ({
            id: yakit.id,
            aracId: yakit.aracId,
            tarih: yakit.tarih,
            km: Number(yakit.km || 0),
            litre: Number(yakit.litre || 0),
            tutar: Number(yakit.tutar || 0),
            soforId: yakit.soforId || yakit.sofor?.id || null,
        }))
    ).byVehicleId.get((aracRaw as any).id);
    const arac = {
        ...aracRaw,
        sirket: (aracRaw as any).sirket || null,
        disFirma: (aracRaw as any).disFirma || null,
        kullanici: inferredKullanici,
        kullaniciId: (aracRaw as any).kullaniciId || inferredKullanici?.id || null,
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
        ortalamaYakit100Km: yakitMetric?.averageLitresPer100Km ?? null,
        ortalamaYakitIntervalSayisi: yakitMetric?.intervalCount ?? 0,
    };

    return (
        <AracDetailClient
            initialArac={arac as any}
            kullanicilar={kullanicilar.map((u: any) => ({
                id: u.id,
                adSoyad: `${u.ad} ${u.soyad}`.trim(),
                sirketId: u.sirketId || null,
                sirketAd: u.sirket?.ad || null,
            }))}
            sirketler={sirketler as any[]}
            disFirmalar={disFirmalar as any[]}
        />
    );
}
