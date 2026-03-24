import dotenv from "dotenv";

dotenv.config();

const { prisma } = await import("../src/lib/prisma.ts");

try {
  const araclar = await prisma.arac.findMany({
    select: { id: true, kullaniciId: true, durum: true },
  });

  let updated = 0;

  for (const arac of araclar) {
    let nextDurum = arac.kullaniciId ? "AKTIF" : "BOSTA";

    const arizaModel = prisma.arizaKaydi;
    if (arizaModel?.findMany) {
      const openArizalar = await arizaModel.findMany({
        where: {
          aracId: arac.id,
          durum: { in: ["ACIK", "SERVISTE"] },
        },
        select: { durum: true },
      });

      if (openArizalar.some((row) => row.durum === "SERVISTE")) {
        nextDurum = "SERVISTE";
      } else if (openArizalar.length > 0) {
        nextDurum = "ARIZALI";
      }
    }

    if (arac.durum !== nextDurum) {
      await prisma.arac.update({
        where: { id: arac.id },
        data: { durum: nextDurum },
      });
      updated += 1;
    }
  }

  console.log("Arac durum sync tamamlandi:", { total: araclar.length, updated });
} catch (error) {
  console.error("Arac durum sync hatasi:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
