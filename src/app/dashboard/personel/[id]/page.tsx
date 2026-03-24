import { prisma } from "../../../../lib/prisma";
import PersonelDetailClient from "./PersonelDetailClient";
import { notFound } from "next/navigation";
import { getModelFilter, getSirketListFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function PersonelDetailPage(props: { params: Promise<{ id: string }>; searchParams?: Promise<DashboardSearchParams> }) {
    const params = await props.params;
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const [personelFilter, sirketListFilter, aracFilter] = await Promise.all([
        getModelFilter("kullanici", selectedSirketId),
        getSirketListFilter(),
        getModelFilter("arac", selectedSirketId),
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

    const arizalar = await (prisma as any).arizaKaydi
        .findMany({
            where: {
                soforId: personel.id,
                ...(selectedSirketId ? { sirketId: selectedSirketId } : {}),
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
        });

    // Eski/yeni şema farklarını tek formata çek.
    const normalizedPersonel = {
        ...personel,
        sirket: personel.sirket || null,
        hesap: personel.hesap || null,
        arac: personel.arac || null,
        zimmetler: personel.zimmetler || [],
        arizalar: arizalar || [],
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
            },
            select: {
                id: true,
                plaka: true,
                marka: true,
                model: true,
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
