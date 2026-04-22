"use server";

import prisma from "@/lib/prisma";
import { assertAuthenticatedUser } from "@/lib/action-scope";
import { getModelFilter, getPersonnelSelectFilter, getSirketListFilter } from "@/lib/auth-utils";

export async function getSirketlerSelect() {
    await assertAuthenticatedUser();
    const sirketFilter = await getSirketListFilter();
    const sirketler = await prisma.sirket.findMany({
        where: sirketFilter as any,
        orderBy: { ad: "asc" },
        select: { id: true, ad: true, bulunduguIl: true, santiyeler: true },
    });
    return sirketler;
}

export async function getKullanicilarSelect() {
    await assertAuthenticatedUser();
    const kullaniciFilter = await getPersonnelSelectFilter();
    const kullanicilar = await prisma.kullanici.findMany({
        where: {
            ...(kullaniciFilter as any),
            deletedAt: null,
            arac: { is: null },
            zimmetler: {
                none: {
                    bitis: null,
                },
            },
        },
        orderBy: [{ ad: "asc" }, { soyad: "asc" }],
        select: {
            id: true,
            ad: true,
            soyad: true,
            calistigiKurum: true,
            sirket: { select: { ad: true } },
        },
    });
    return kullanicilar.map((k) => ({
        id: k.id,
        adSoyad: `${k.ad || ""} ${k.soyad || ""}`.trim(),
        sirketAd: k.sirket?.ad || k.calistigiKurum || null,
        calistigiKurum: k.calistigiKurum || null,
    }));
}

export async function getAraclarSelect() {
    await assertAuthenticatedUser();
    const aracFilter = await getModelFilter("arac");
    const araclar = await prisma.arac.findMany({
        where: {
            ...(aracFilter as any),
            deletedAt: null,
            kullaniciId: null,
            kullaniciGecmisi: {
                none: {
                    bitis: null,
                },
            },
        },
        orderBy: { plaka: "asc" },
        select: { id: true, plaka: true, marka: true, model: true, bulunduguIl: true, guncelKm: true, durum: true },
    });
    return araclar;
}
