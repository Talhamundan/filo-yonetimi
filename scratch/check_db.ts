
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const fuelCount = await prisma.yakit.count();
  const fuelWithSofor = await prisma.yakit.count({ where: { NOT: { soforId: null } } });
  const first10Sofors = await prisma.yakit.findMany({ 
    where: { NOT: { soforId: null } }, 
    select: { soforId: true }, 
    take: 10 
  });
  
  console.log('Total fuel records:', fuelCount);
  console.log('Fuel records with soforId:', fuelWithSofor);
  
  for (const f of first10Sofors) {
    if (!f.soforId) continue;
    const user = await prisma.kullanici.findUnique({ where: { id: f.soforId } });
    console.log('SoforId:', f.soforId, 'User exists:', !!user, 'DeletedAt:', user?.deletedAt);
  }

  const users = await prisma.kullanici.count({ where: { deletedAt: null } });
  console.log('Active users count:', users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
