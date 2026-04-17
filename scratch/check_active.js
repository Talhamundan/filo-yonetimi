const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const count = await prisma.kullanici.count({
        where: { deletedAt: null }
    });
    const withDeleted = await prisma.kullanici.count();
    console.log('Active users:', count);
    console.log('Total users (inc deleted):', withDeleted);
    
    const sample = await prisma.kullanici.findMany({
        take: 5,
        select: { ad: true, soyad: true, sirketId: true, deletedAt: true }
    });
    console.log('Sample:', sample);
    
    await prisma.$disconnect();
}
run();
