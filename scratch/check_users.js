const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const users = await prisma.kullanici.findMany({
        select: { id: true, ad: true, soyad: true, sirketId: true, deletedAt: true }
    });
    console.log(JSON.stringify(users, null, 2));
    await prisma.$disconnect();
}
run();
