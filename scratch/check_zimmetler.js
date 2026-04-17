const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const zimmetCount = await prisma.kullaniciZimmet.count();
        console.log('Total zimmet count:', zimmetCount);
        
        const activeZimmetCount = await prisma.kullaniciZimmet.count({
            where: { bitis: null }
        });
        console.log('Active zimmet count:', activeZimmetCount);
        
        const sample = await prisma.kullaniciZimmet.findMany({
            take: 10,
            orderBy: { baslangic: 'desc' },
            include: {
                kullanici: { select: { ad: true, soyad: true } },
                arac: { select: { plaka: true } }
            }
        });
        console.log('Recent zimmetler:', JSON.stringify(sample, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
