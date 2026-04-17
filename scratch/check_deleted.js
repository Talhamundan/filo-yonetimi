
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const deletedVehicles = await prisma.arac.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true, plaka: true, deletedAt: true }
  });
  console.log(JSON.stringify(deletedVehicles, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
