const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        console.log('Connecting to database...');
        
        // Find users who have assignments created in the last 20 minutes
        const query = `
            SELECT DISTINCT p.id, p.ad, p.soyad
            FROM "Personel" p
            JOIN "PersonelZimmet" z ON p.id = z."kullaniciId"
            WHERE z.baslangic > NOW() - INTERVAL '20 minutes'
        `;
        
        const { rows: duplicates } = await pool.query(query);
        console.log(`Found ${duplicates.length} potential duplicate users based on recent assignments.`);
        
        if (duplicates.length === 0) {
            console.log('No recent assignments found.');
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
