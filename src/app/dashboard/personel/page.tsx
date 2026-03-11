import React from "react";
import { prisma } from "@/lib/prisma";
import PersonelClient from "./Client";
import { getModelFilter, getCurrentSirketId } from "@/lib/auth-utils";

export default async function PersonelPage() {
    const filter = await getModelFilter('personel');
    const sirketId = await getCurrentSirketId();

    const [personeller, sirketler] = await Promise.all([
        (prisma as any).kullanici.findMany({
            where: {
                ...(filter as any),
            },
            orderBy: { ad: 'asc' },
            include: { 
                sirket: true,
                arac: { select: { plaka: true, marka: true, model: true } }
            }
        }),
        (prisma as any).sirket.findMany({ 
            where: sirketId ? { id: sirketId } : {},
            select: { id: true, ad: true },
            orderBy: { ad: 'asc' }
        })
    ]);

    const formattedData = personeller.map((p: any) => ({
        id: p.id,
        adSoyad: `${p.ad} ${p.soyad}`,
        tcNo: p.tcNo || "-",
        telefon: p.telefon || "-",
        eposta: p.eposta || "-",
        rol: p.rol,
        sirketAdi: p.sirket?.ad || "Bağımsız",
        sirketId: p.sirketId || "",
        sehir: p.sehir || "-",
        zimmetliArac: p.arac ? `${p.arac.plaka} (${p.arac.marka} ${p.arac.model})` : null
    }));

    return <PersonelClient initialData={formattedData} sirketler={sirketler} />;
}
