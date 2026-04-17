const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const query = 'SELECT id, ad, soyad FROM "Personel" WHERE "tcNo" IS NULL AND "eposta" IS NULL';
        const { rows } = await pool.query(query);
        console.log(`Found ${rows.length} users with no TC No and no E-mail.`);
        console.log('Sample:', rows.slice(0, 5));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
