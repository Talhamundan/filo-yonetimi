const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        console.log('Finding duplicates by name...');
        
        // Find users with same ad and soyad
        const query = `
            SELECT ad, soyad, array_agg(id) as ids
            FROM "Personel"
            GROUP BY ad, soyad
            HAVING count(*) > 1
        `;
        
        const { rows: duplicateGroups } = await pool.query(query);
        console.log(`Found ${duplicateGroups.length} duplicate name groups.`);
        
        const idsToDelete = [];
        for (const group of duplicateGroups) {
            // Keep the first one, delete the rest
            // Since we don't have a reliable creation date, we'll keep the one with the 'smaller' ID? 
            // Or just any one.
            const sortedIds = group.ids.sort();
            const toDelete = sortedIds.slice(1);
            idsToDelete.push(...toDelete);
        }
        
        console.log(`Total records to delete: ${idsToDelete.length}`);
        
        if (idsToDelete.length === 0) {
            console.log('No duplicates found.');
            return;
        }

        const idsStr = idsToDelete.map(id => `'${id}'`).join(',');
        
        // Delete assignments first
        const zimmetDelete = await pool.query(`DELETE FROM "PersonelZimmet" WHERE "kullaniciId" IN (${idsStr})`);
        console.log(`Deleted ${zimmetDelete.rowCount} assignments.`);
        
        // Delete users
        const userDelete = await pool.query(`DELETE FROM "Personel" WHERE id IN (${idsStr})`);
        console.log(`Deleted ${userDelete.rowCount} users.`);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
