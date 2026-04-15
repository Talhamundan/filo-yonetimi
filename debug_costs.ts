import { prisma } from "./src/lib/prisma";

async function debug() {
    const sirketler = await prisma.sirket.findMany({ select: { id: true, ad: true } });
    console.log("Companies in DB:", JSON.stringify(sirketler, null, 2));

    const yakitRecords = await prisma.yakit.findMany({
        select: { arac: { select: { calistigiKurum: true } } }
    });
    const yakitUniqueNames = [...new Set(yakitRecords.map(y => y.arac?.calistigiKurum).filter(Boolean))];
    console.log("Unique calistigiKurum in Yakit:", JSON.stringify(yakitUniqueNames, null, 2));

    const bakimRecords = await prisma.bakim.findMany({
        select: { arac: { select: { calistigiKurum: true } } }
    });
    const bakimUniqueNames = [...new Set(bakimRecords.map(b => b.arac?.calistigiKurum).filter(Boolean))];
    console.log("Unique calistigiKurum in Bakim:", JSON.stringify(bakimUniqueNames, null, 2));
}

debug();
