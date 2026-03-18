import { prisma } from "@/lib/prisma";
import OnayMerkeziClient from "./OnayMerkeziClient";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function OnayMerkeziPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const session = await auth();

    if (session?.user?.rol !== 'ADMIN') {
        redirect("/dashboard");
    }

    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const kullaniciFilter = await getModelFilter("kullanici", selectedSirketId);

    const users = await (prisma as any).kullanici.findMany({
        where: {
            ...(kullaniciFilter as any),
            onayDurumu: 'BEKLIYOR',
        },
        include: { sirket: true },
        orderBy: { ad: 'asc' }
    });

    return <OnayMerkeziClient initialUsers={users} />;
}
