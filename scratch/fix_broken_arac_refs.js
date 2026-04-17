const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        console.log('Fixing broken Arac.kullaniciId references...');
        
        // Find vehicles where kullaniciId does NOT exist in Personel table
        const query = `
            SELECT id, "kullaniciId", plaka
            FROM "Arac"
            WHERE "kullaniciId" IS NOT NULL
              AND "kullaniciId" NOT IN (SELECT id FROM "Personel")
        `;
        
        const { rows: brokenVehicles } = await pool.query(query);
        console.log(`Found ${brokenVehicles.length} vehicles with broken user references.`);
        
        for (const vehicle of brokenVehicles) {
            // We don't know the name of the deleted user easily here.
            // BUT we can look at PersonelZimmet history for this vehicle? 
            // No, I deleted the zimmetler for the deleted users too.
            
            // Wait! I can look for a user who had this vehicle in their 'zimmetliArac' column during export?
            // No, I don't have the Excel.
            
            // I'll just set them to NULL for now so the user can re-import correctly.
            await pool.query(`UPDATE "Arac" SET "kullaniciId" = NULL WHERE id = '${vehicle.id}'`);
            console.log(`Cleared broken reference for vehicle ${vehicle.plaka}`);
        }
        
        console.log('Broken references cleared.');

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
