const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.yakit.findMany({
      where: { endeks: 0 },
      take: 1
    });
    console.log('SUCCESS');
  } catch (e) {
    console.error(e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
