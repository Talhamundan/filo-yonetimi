"use server";

import prisma from "@/lib/prisma";
import { assertAuthenticatedUser } from "@/lib/action-scope";
import { getModelFilter, getSirketListFilter } from "@/lib/auth-utils";

export async function getSirketlerSelect() {
    await assertAuthenticatedUser();
    const sirketFilter = await getSirketListFilter();
    const sirketler = await prisma.sirket.findMany({
        where: sirketFilter as any,
        orderBy: { ad: "asc" },
        select: { id: true, ad: true, bulunduguIl: true },
    });
    return sirketler;
}

export async function getKullanicilarSelect() {
    await assertAuthenticatedUser();
    const kullaniciFilter = await getModelFilter("kullanici");
    const kullanicilar = await prisma.kullanici.findMany({
        where: { ...(kullaniciFilter as any), deletedAt: null },
        orderBy: [{ ad: "asc" }, { soyad: "asc" }],
        select: { id: true, ad: true, soyad: true },
    });
    return kullanicilar.map((k) => ({
        id: k.id,
        adSoyad: `${k.ad || ""} ${k.soyad || ""}`.trim(),
    }));
}

export async function getAraclarSelect() {
    await assertAuthenticatedUser();
    const aracFilter = await getModelFilter("arac");
    const araclar = await prisma.arac.findMany({
        where: { ...(aracFilter as any), deletedAt: null },
        orderBy: { plaka: "asc" },
        select: { id: true, plaka: true, marka: true, model: true, bulunduguIl: true, guncelKm: true },
    });
    return araclar;
}
