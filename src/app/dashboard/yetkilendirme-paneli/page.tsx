import { prisma } from "@/lib/prisma";
import OnayMerkeziClient from "./OnayMerkeziClient";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPersonnelSelectFilter } from "@/lib/auth-utils";
import type { Prisma } from "@prisma/client";

export default async function OnayMerkeziPage() {
    const session = await auth();

    if (session?.user?.rol !== 'ADMIN') {
        redirect("/dashboard");
    }

    const kullaniciFilter = await getPersonnelSelectFilter();
    const baseKullaniciFilter = kullaniciFilter as Prisma.KullaniciWhereInput;

    const registeredUsers = await prisma.kullanici.findMany({
        where: {
            AND: [
                baseKullaniciFilter,
                {
                    hesap: { isNot: null },
                },
            ],
        },
        include: { sirket: true, hesap: true },
        orderBy: [{ ad: "asc" }, { soyad: "asc" }],
    });
    const assignablePersoneller = await prisma.kullanici.findMany({
        where: {
            AND: [
                baseKullaniciFilter,
                {
                    hesap: null,
                    rol: { not: "SOFOR" },
                },
            ],
        },
        select: {
            id: true,
            ad: true,
            soyad: true,
            rol: true,
            sirket: { select: { ad: true } },
        },
        orderBy: [{ ad: "asc" }, { soyad: "asc" }],
    });
    const assignableOptions = assignablePersoneller.map((row) => ({
        id: row.id,
        adSoyad: `${row.ad} ${row.soyad}`.trim(),
        rol: row.rol,
        sirketAdi: row.sirket?.ad || "Bağımsız",
    }));

    return (
        <OnayMerkeziClient
            registeredUsers={registeredUsers}
            assignablePersoneller={assignableOptions}
        />
    );
}
