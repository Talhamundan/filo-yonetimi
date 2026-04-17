const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        // Find users created in the last 15 minutes
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        
        const duplicates = await prisma.kullanici.findMany({
            where: {
                olusturmaTarihi: { gte: fifteenMinutesAgo }
            },
            select: { id: true, ad: true, soyad: true }
        });
        
        console.log(`Found ${duplicates.length} potential duplicates created since ${fifteenMinutesAgo.toISOString()}`);
        
        if (duplicates.length === 0) {
            console.log('No duplicates found.');
            return;
        }

        const duplicateIds = duplicates.map(d => d.id);
        
        // Delete assignments for these users
        const zimmetDelete = await prisma.kullaniciZimmet.deleteMany({
            where: { kullaniciId: { in: duplicateIds } }
        });
        console.log(`Deleted ${zimmetDelete.count} assignments.`);
        
        // Delete the users
        const userDelete = await prisma.kullanici.deleteMany({
            where: { id: { in: duplicateIds } }
        });
        console.log(`Deleted ${userDelete.count} users.`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
