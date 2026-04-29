import { prisma } from "@/lib/prisma";
import OnayMerkeziClient from "./OnayMerkeziClient";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getModelFilter, getPersonnelSelectFilter, getSirketListFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";
import { Prisma, Rol } from "@prisma/client";

const YAKIT_TANK_HAS_SIRKET_FIELD = Boolean(
    (prisma as any)?._runtimeDataModel?.models?.YakitTank?.fields?.some((field: any) => field?.name === "sirketId") ||
    Prisma.dmmf.datamodel.models
        .find((model) => model.name === "YakitTank")
        ?.fields.some((field) => field.name === "sirketId")
);

export default async function OnayMerkeziPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const session = await auth();

    if (session?.user?.rol !== 'ADMIN') {
        redirect("/dashboard");
    }

    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const [kullaniciFilter, yakitTankFilter, sirketListFilter] = await Promise.all([
        getPersonnelSelectFilter(),
        YAKIT_TANK_HAS_SIRKET_FIELD ? getModelFilter("yakitTank", selectedSirketId) : Promise.resolve({}),
        getSirketListFilter(),
    ]);
    const baseKullaniciFilter = kullaniciFilter as Prisma.KullaniciWhereInput;

    const registeredUsers = await prisma.kullanici.findMany({
        where: {
            AND: [
                baseKullaniciFilter,
                {
                    hesap: {
                        is: {},
                    },
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
                    hesap: { is: null },
                    rol: { not: Rol.PERSONEL },
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
    const sirketListWhere = selectedSirketId ? { id: selectedSirketId } : (sirketListFilter as any);
    const [yakitTanklar, sirketler] = await Promise.all([
        (prisma as any).yakitTank.findMany({
            where: yakitTankFilter as any,
            ...(YAKIT_TANK_HAS_SIRKET_FIELD
                ? { include: { sirket: { select: { id: true, ad: true } } } }
                : {}),
            orderBy: { ad: "asc" },
        }),
        (prisma as any).sirket.findMany({
            where: sirketListWhere,
            select: { id: true, ad: true },
            orderBy: { ad: "asc" },
        }),
    ]);
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
            yakitTanklar={yakitTanklar}
            sirketler={sirketler as Array<{ id: string; ad: string }>}
            selectedScopeSirketId={selectedSirketId || null}
            canScopeTankByCompany={YAKIT_TANK_HAS_SIRKET_FIELD}
        />
    );
}
