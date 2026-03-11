import { prisma } from "@/lib/prisma";
import OnayMerkeziClient from "./OnayMerkeziClient";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function OnayMerkeziPage() {
    const session = await auth();

    if (session?.user?.rol !== 'ADMIN') {
        redirect("/dashboard");
    }

    const users = await (prisma as any).kullanici.findMany({
        where: { onayDurumu: 'BEKLIYOR' },
        include: { sirket: true },
        orderBy: { ad: 'asc' }
    });

    return <OnayMerkeziClient initialUsers={users} />;
}
