const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const user = await prisma.kullanici.findFirst({
        where: { ad: { contains: 'ABDULAZ' } },
        select: { id: true, ad: true, soyad: true, sirketId: true, sirket: { select: { ad: true } } }
    });
    console.log('User:', user);
    
    const expenses = await prisma.yakit.count({ where: { soforId: user?.id } });
    console.log('Direct yakit count:', expenses);
    
    const zimmetler = await prisma.kullaniciZimmet.findMany({
        where: { kullaniciId: user?.id },
        include: { arac: { select: { plaka: true } } }
    });
    console.log('Zimmetler:', zimmetler);
    
    await prisma.$disconnect();
}
run();
