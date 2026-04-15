const { prisma } = require('./src/lib/prisma');

async function main() {
  try {
    const result = await prisma.yakit.findMany({
      take: 1
    });
    console.log('SUCCESS: Found', result.length, 'records');
  } catch (e) {
    console.error('ERROR_CODE:', e.code);
    console.error('ERROR_MESSAGE:', e.message);
  } finally {
    if (prisma.$disconnect) await prisma.$disconnect();
  }
}

main();
