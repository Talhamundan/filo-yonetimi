import { prisma } from "../../../../lib/prisma";
import PersonelDetailClient from "./PersonelDetailClient";
import { notFound } from "next/navigation";
import { getModelFilter, getSirketListFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";
import { buildFuelIntervalMetrics } from "@/lib/fuel-metrics";

const MACHINE_CATEGORY = "SANTIYE";

export default async function PersonelDetailPage(props: { params: Promise<{ id: string }>; searchParams?: Promise<DashboardSearchParams> }) {
    const params = await props.params;
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const [personelFilter, sirketListFilter, aracFilter, arizaFilter, yakitFilter, bakimFilter] = await Promise.all([
        getModelFilter("kullanici", selectedSirketId),
        getSirketListFilter(),
        getModelFilter("arac", selectedSirketId),
        getModelFilter("arizaKaydi", selectedSirketId),
        getModelFilter("yakit", selectedSirketId),
        getModelFilter("bakim", selectedSirketId),
    ]);

    const whereClause = {
        id: params.id,
        ...(personelFilter as any)
    };

    let personel: any = null;
    try {
        personel = await (prisma as any).kullanici.findFirst({
            where: whereClause,
            include: {
                sirket: true,
                hesap: { select: { kullaniciAdi: true } },
                arac: {
                    include: {
                        sirket: true,
                        yakitlar: { orderBy: { tarih: 'desc' }, take: 20 },
                        bakimlar: { orderBy: { bakimTarihi: 'desc' }, take: 10 },
                        masraflar: { orderBy: { tarih: 'desc' }, take: 10 }
                    }
                },
                zimmetler: {
                    include: { arac: { include: { sirket: true } } },
                    orderBy: { baslangic: 'desc' }
                },
                cezalar: {
                    include: { arac: { include: { sirket: true } } }
                }
            }
        });
    } catch (error) {
        // DB/client şema farkı olduğunda detay include'ları düşürüp sayfayı ayakta tut.
        console.warn("Personel detay gelismis include sorgusu basarisiz, geriye donuk sorgu ile devam ediliyor.", error);
        try {
            personel = await (prisma as any).kullanici.findFirst({
                where: whereClause,
                include: {
                    sirket: true,
                    hesap: { select: { kullaniciAdi: true } },
                    arac: {
                        include: {
                            sirket: true,
                            yakitlar: { orderBy: { tarih: 'desc' }, take: 20 },
                            bakimlar: { orderBy: { bakimTarihi: 'desc' }, take: 10 },
                            masraflar: { orderBy: { tarih: 'desc' }, take: 10 }
                        }
                    },
                    zimmetler: {
                        include: { arac: { include: { sirket: true } } },
                        orderBy: { baslangic: 'desc' }
                    }
                }
            });
        } catch (legacyError) {
            console.warn("Personel detay geriye donuk include sorgusu da basarisiz, minimal sorgu ile devam ediliyor.", legacyError);
            personel = await (prisma as any).kullanici.findFirst({
                where: whereClause
            });
        }
    }

    if (!personel) {
        notFound();
    }

    const personelZimmetAraliklari = ((personel.zimmetler || []) as any[])
        .filter((z) => typeof z?.aracId === "string" && z.aracId.trim().length > 0)
        .map((z) => ({
            aracId: z.aracId as string,
            baslangic: z?.baslangic ? new Date(z.baslangic).getTime() : null,
            bitis: z?.bitis ? new Date(z.bitis).getTime() : null,
        }))
        .filter((z) => Number.isFinite(z.baslangic));

    const personelZimmetAracIdleri = Array.from(new Set(personelZimmetAraliklari.map((z) => z.aracId)));
    const matchesPersonelZimmetAtDate = (aracId: string | null | undefined, dateValue: Date | string | null | undefined) => {
        if (!aracId || !dateValue) return false;
        const target = new Date(dateValue).getTime();
        if (!Number.isFinite(target)) return false;
        return personelZimmetAraliklari.some((zimmet) => {
            if (zimmet.aracId !== aracId) return false;
            if (!Number.isFinite(zimmet.baslangic as number)) return false;
            return (zimmet.baslangic as number) <= target && (zimmet.bitis === null || zimmet.bitis >= target);
        });
    };

    const [rawArizalar, rawYakitKayitlari, rawBakimKayitlari] = await Promise.all([
        (prisma as any).arizaKaydi
            .findMany({
                where: {
                    AND: [
                        personelZimmetAracIdleri.length > 0
                            ? {
                                  OR: [{ soforId: personel.id }, { aracId: { in: personelZimmetAracIdleri } }],
                              }
                            : { soforId: personel.id },
                        arizaFilter as any,
                    ],
                },
                include: {
                    arac: {
                        include: {
                            sirket: true,
                        },
                    },
                },
                orderBy: [{ durum: "asc" }, { bildirimTarihi: "desc" }],
                take: 100,
            })
            .catch((error: any) => {
                console.warn("Personel arıza kayıtları alınamadı.", error);
                return [];
            }),
        (prisma as any).yakit
            .findMany({
                where: {
                    AND: [
                        personelZimmetAracIdleri.length > 0
                            ? {
                                  OR: [{ soforId: personel.id }, { aracId: { in: personelZimmetAracIdleri } }],
                              }
                            : { soforId: personel.id },
                        yakitFilter as any,
                    ],
                },
                include: {
                    arac: {
                        include: {
                            sirket: true,
                        },
                    },
                },
                orderBy: { tarih: "desc" },
                take: 100,
            })
            .catch((error: any) => {
                console.warn("Personel yakıt kayıtları alınamadı.", error);
                return [];
            }),
        (prisma as any).bakim
            .findMany({
                where: {
                    AND: [
                        personelZimmetAracIdleri.length > 0
                            ? {
                                  OR: [{ soforId: personel.id }, { aracId: { in: personelZimmetAracIdleri } }],
                              }
                            : { soforId: personel.id },
                        bakimFilter as any,
                    ],
                },
                include: {
                    arac: {
                        include: {
                            sirket: true,
                        },
                    },
                },
                orderBy: { bakimTarihi: "desc" },
                take: 100,
            })
            .catch((error: any) => {
                console.warn("Personel servis kayıtları alınamadı.", error);
                return [];
            }),
    ]);
    const arizalar = (rawArizalar as any[]).filter((kayit) => {
        if (kayit?.soforId === personel.id) return true;
        if (kayit?.soforId) return false;
        return (
            matchesPersonelZimmetAtDate(kayit?.aracId, kayit?.bildirimTarihi) ||
            (typeof kayit?.arac?.kullaniciId === "string" && kayit.arac.kullaniciId === personel.id)
        );
    });
    const yakitKayitlari = (rawYakitKayitlari as any[]).filter((kayit) => {
        if (kayit?.soforId === personel.id) return true;
        if (kayit?.soforId) return false;
        return (
            matchesPersonelZimmetAtDate(kayit?.aracId, kayit?.tarih) ||
            (typeof kayit?.arac?.kullaniciId === "string" && kayit.arac.kullaniciId === personel.id)
        );
    });
    const bakimKayitlari = (rawBakimKayitlari as any[]).filter((kayit) => {
        if (kayit?.soforId === personel.id) return true;
        if (kayit?.soforId) return false;
        return (
            matchesPersonelZimmetAtDate(kayit?.aracId, kayit?.bakimTarihi) ||
            (typeof kayit?.arac?.kullaniciId === "string" && kayit.arac.kullaniciId === personel.id)
        );
    });

    const personelYakitAracIdleri = Array.from(
        new Set(
            (yakitKayitlari as any[])
                .filter((kayit) => kayit?.arac?.kategori === MACHINE_CATEGORY)
                .map((kayit) => (typeof kayit?.aracId === "string" ? kayit.aracId : ""))
                .filter((id) => id.length > 0)
        )
    );

    const yakitMetrikKayitlari =
        personelYakitAracIdleri.length > 0
            ? await (prisma as any).yakit
                  .findMany({
                      where: {
                          AND: [
                              yakitFilter as any,
                              { aracId: { in: personelYakitAracIdleri } },
                          ],
                      },
                      select: {
                          id: true,
                          aracId: true,
                          tarih: true,
                          km: true,
                          litre: true,
                          tutar: true,
                          soforId: true,
                          arac: { select: { kullaniciId: true, kategori: true } },
                      },
                      orderBy: [{ aracId: "asc" }, { tarih: "asc" }],
                  })
                  .catch((error: any) => {
                      console.warn("Personel yakıt ortalama metrik kayıtları alınamadı.", error);
                      return [];
                  })
            : [];

    const personelYakitMetrikleriBySofor = buildFuelIntervalMetrics(
        (yakitMetrikKayitlari as any[])
            .filter((kayit) => kayit?.arac?.kategori === MACHINE_CATEGORY)
            .map((kayit) => ({
            id: kayit.id,
            aracId: kayit.aracId,
            tarih: kayit.tarih,
            km: Number(kayit.km || 0),
            litre: Number(kayit.litre || 0),
            tutar: Number(kayit.tutar || 0),
            soforId: kayit.soforId || null,
        }))
    ).byDriverId;
    const personelYakitMetrigi = personelYakitMetrikleriBySofor.get(personel.id);
    const driverAverageValues = [...personelYakitMetrikleriBySofor.values()]
        .filter((metric) => metric.intervalCount > 0 && Number(metric.averageLitresPer100Km || 0) > 0)
        .map((metric) => Number(metric.averageLitresPer100Km || 0));
    const driverFleetAverage100Km =
        driverAverageValues.length > 0
            ? driverAverageValues.reduce((sum, value) => sum + value, 0) / driverAverageValues.length
            : 0;
    const personelOrtalamaYakit100Km = personelYakitMetrigi?.averageLitresPer100Km ?? null;
    const personelYakitIntervalSayisi = personelYakitMetrigi?.intervalCount ?? 0;
    const personelOrtalamaUstuYakit =
        personelOrtalamaYakit100Km != null &&
        personelYakitIntervalSayisi > 0 &&
        driverFleetAverage100Km > 0 &&
        Number(personelOrtalamaYakit100Km) > Number(driverFleetAverage100Km);

    // Eski/yeni şema farklarını tek formata çek.
    const activeZimmet = (personel.zimmetler || []).find((z: any) => !z.bitis) || null;
    const normalizedPersonel = {
        ...personel,
        sirket: personel.sirket || null,
        hesap: personel.hesap || null,
        arac: personel.arac || activeZimmet?.arac || null,
        zimmetler: personel.zimmetler || [],
        arizalar: arizalar || [],
        yakitKayitlari: yakitKayitlari || [],
        bakimKayitlari: bakimKayitlari || [],
        cezalar: (personel.cezalar || [])
            .map((c: any) => ({
                ...c,
                tarih: c.tarih ?? c.cezaTarihi ?? null,
                cezaMaddesi: c.cezaMaddesi ?? c.aciklama ?? "Belirtilmedi",
            }))
            .sort((a: any, b: any) => {
                const aDate = a?.tarih ? new Date(a.tarih).getTime() : 0;
                const bDate = b?.tarih ? new Date(b.tarih).getTime() : 0;
                return bDate - aDate;
            }),
        ortalamaYakit100Km: personelOrtalamaYakit100Km,
        ortalamaYakitIntervalSayisi: personelYakitIntervalSayisi,
        yakitKarsilastirmaReferans100Km: driverFleetAverage100Km > 0 ? driverFleetAverage100Km : null,
        ortalamaUstuYakit: personelOrtalamaUstuYakit,
    };

    const [sirketler, atamayaUygunAraclar] = await Promise.all([
        (prisma as any).sirket.findMany({
            where: sirketListFilter as any,
            select: { id: true, ad: true },
            orderBy: { ad: 'asc' }
        }),
        (prisma as any).arac.findMany({
            where: {
                ...(aracFilter as any),
                kullaniciId: null,
                kullaniciGecmisi: {
                    none: {
                        bitis: null,
                    },
                },
            },
            select: {
                id: true,
                plaka: true,
                marka: true,
                model: true,
                durum: true,
                guncelKm: true,
                sirket: { select: { ad: true } }
            },
            orderBy: { plaka: "asc" }
        }).catch((error: any) => {
            console.warn("Atamaya uygun araclar getirilemedi, bos liste ile devam ediliyor.", error);
            return [];
        })
    ]);

    return (
        <PersonelDetailClient
            initialPersonel={normalizedPersonel as any}
            sirketler={sirketler}
            atamayaUygunAraclar={atamayaUygunAraclar as any[]}
        />
    );
}
