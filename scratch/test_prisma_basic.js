const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.yakit.findMany({
      take: 1
    });
    console.log('SUCCESS: Found', result.length, 'records');
  } catch (e) {
    console.error('ERROR_MESSAGE:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
