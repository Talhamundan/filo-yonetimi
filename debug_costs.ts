import { prisma } from "./src/lib/prisma";

async function debug() {
    const sirketler = await prisma.sirket.findMany({ select: { id: true, ad: true } });
    console.log("Companies in DB:", JSON.stringify(sirketler, null, 2));

    const yakitUniqueNames = await prisma.yakit.findMany({
        distinct: ['calistigiKurum'],
        select: { calistigiKurum: true }
    });
    console.log("Unique calistigiKurum in Yakit:", JSON.stringify(yakitUniqueNames, null, 2));

    const bakimUniqueNames = await prisma.bakim.findMany({
        distinct: ['calistigiKurum'],
        select: { calistigiKurum: true }
    });
    console.log("Unique calistigiKurum in Bakim:", JSON.stringify(bakimUniqueNames, null, 2));
}

debug();
