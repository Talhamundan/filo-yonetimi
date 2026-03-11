import { prisma } from "@/lib/prisma";
import RegisterClient from "./RegisterClient";

export default async function RegisterPage() {
    const sirketler = await (prisma as any).sirket.findMany({
        select: { id: true, ad: true },
        orderBy: { ad: 'asc' }
    });

    return <RegisterClient sirketler={sirketler} />;
}
