const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        console.log('Repairing assignments...');
        
        // Find vehicles that have a kullaniciId but NO active assignment in PersonelZimmet
        const query = `
            SELECT id, "kullaniciId", plaka
            FROM "Arac"
            WHERE "kullaniciId" IS NOT NULL
              AND id NOT IN (SELECT "aracId" FROM "PersonelZimmet" WHERE bitis IS NULL)
        `;
        
        const { rows: orphanedVehicles } = await pool.query(query);
        console.log(`Found ${orphanedVehicles.length} vehicles with missing active assignments.`);
        
        for (const vehicle of orphanedVehicles) {
            console.log(`Repairing assignment for vehicle ${vehicle.plaka} to user ${vehicle.kullaniciId}`);
            // Create a new assignment starting from Jan 1st 2026
            await pool.query(`
                INSERT INTO "PersonelZimmet" ("id", "aracId", "kullaniciId", "baslangic", "baslangicKm")
                VALUES ('rep_' || gen_random_uuid(), '${vehicle.id}', '${vehicle.kullaniciId}', '2026-01-01', 0)
            `);
        }
        
        console.log('Repair completed.');

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
