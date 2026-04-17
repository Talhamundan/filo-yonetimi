const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        console.log('Connecting to database...');
        
        // Find users created in the last 20 minutes
        const minutes = 20;
        const query = `
            SELECT id, ad, soyad, "olusturmaTarihi"
            FROM "Personel"
            WHERE "olusturmaTarihi" > NOW() - INTERVAL '${minutes} minutes'
        `;
        
        const { rows: duplicates } = await pool.query(query);
        console.log(`Found ${duplicates.length} potential duplicates.`);
        
        if (duplicates.length === 0) {
            console.log('No duplicates found.');
            return;
        }

        const ids = duplicates.map(d => `'${d.id}'`).join(',');
        
        // Delete assignments
        const zimmetDelete = await pool.query(`DELETE FROM "PersonelZimmet" WHERE "kullaniciId" IN (${ids})`);
        console.log(`Deleted ${zimmetDelete.rowCount} assignments.`);
        
        // Delete users
        const userDelete = await pool.query(`DELETE FROM "Personel" WHERE id IN (${ids})`);
        console.log(`Deleted ${userDelete.rowCount} users.`);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
