require('dotenv').config();
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  const total = await c.query('SELECT COUNT(*)::int AS n FROM "Arac" WHERE "deletedAt" IS NULL');
  const excluded = await c.query(`
    SELECT a.id, a.plaka, a.marka, a.model, a."sirketId", s.ad AS sirket_ad,
           a."disFirmaId", d.ad AS dis_firma_ad, d.tur AS dis_firma_tur
    FROM "Arac" a
    LEFT JOIN "Sirket" s ON s.id = a."sirketId"
    LEFT JOIN "DisFirma" d ON d.id = a."disFirmaId"
    WHERE a."deletedAt" IS NULL
      AND ((d.tur = 'KIRALIK') OR lower(s.ad) = lower('Kiralık'))
    ORDER BY a.plaka NULLS LAST, a.id
  `);
  const by = await c.query(`
    SELECT COALESCE(s.ad, '(yok)') AS sirket,
           COALESCE(d.tur::text, '(yok)') AS dis_tur,
           COUNT(*)::int AS n
    FROM "Arac" a
    LEFT JOIN "Sirket" s ON s.id = a."sirketId"
    LEFT JOIN "DisFirma" d ON d.id = a."disFirmaId"
    WHERE a."deletedAt" IS NULL
    GROUP BY 1, 2
    ORDER BY n DESC
  `);
  console.log('total', total.rows);
  console.log('excluded count', excluded.rows.length);
  console.table(excluded.rows);
  console.table(by.rows);
  await c.end();
})().catch(async (e) => {
  console.error(e);
  try { await c.end(); } catch {}
  process.exit(1);
});
