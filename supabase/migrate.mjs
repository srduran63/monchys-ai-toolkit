// Applies supabase/migrations/*.sql in order (each one once, inside a transaction).
//   npm run db:migrate            -> create / update the tables
//   npm run db:migrate -- --seed  -> also copy the current catalog and businesses from server/data/
// Needs DATABASE_URL in .env (Supabase → Project Settings → Database → Connection string → URI).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'supabase', 'migrations');

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en .env (Supabase → Project Settings → Database → Connection string → URI).');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires TLS
});

async function migrate() {
  await client.query(`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await client.query('select name from schema_migrations')).rows.map((r) => r.name));
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (done.has(file)) {
      console.log(`· ${file} (ya aplicada)`);
      continue;
    }
    const sql = await fs.readFile(path.join(DIR, file), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log(`✓ ${file}`);
    } catch (err) {
      await client.query('rollback');
      throw new Error(`${file}: ${err.message}`);
    }
  }
}

// Copies the catalog and the booking businesses that exist today (idempotent).
async function seed() {
  const read = async (f) => JSON.parse(await fs.readFile(path.join(ROOT, 'server', 'data', f), 'utf8').catch(() => '[]'));
  const products = await read('products.json');
  const businesses = await read('businesses.json');
  await client.query('begin');
  try {
    for (const [i, p] of products.entries()) {
      await client.query(
        `insert into products (id, name, price, period, category, icon, "desc", details, specs, tool_url, demo_url, includes, published, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         on conflict (id) do update set name = excluded.name, price = excluded.price, period = excluded.period,
           category = excluded.category, icon = excluded.icon, "desc" = excluded."desc", details = excluded.details,
           specs = excluded.specs, tool_url = excluded.tool_url, demo_url = excluded.demo_url, includes = excluded.includes,
           published = excluded.published, sort_order = excluded.sort_order, updated_at = now()`,
        [p.id, p.name, p.price, p.period ?? 'once', p.category, p.icon, p.desc, p.details ?? '', p.specs ?? {}, p.toolUrl ?? '', p.demoUrl ?? '', p.includes ?? [], p.published !== false, i]
      );
    }
    for (const b of businesses) {
      await client.query(
        `insert into businesses (id, name, description, timezone, slot_minutes, hours, faq, owner_email, active)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing`,
        [b.id, b.name, b.description ?? '', b.timezone, b.slotMinutes, JSON.stringify(b.hours), b.faq ?? '', b.ownerEmail || null, b.active !== false]
      );
      for (const [i, s] of (b.services ?? []).entries()) {
        await client.query(
          `insert into business_services (business_id, id, name, minutes, price, sort_order) values ($1,$2,$3,$4,$5,$6)
           on conflict (business_id, id) do nothing`,
          [b.id, s.id, s.name, s.minutes, s.price, i]
        );
      }
      for (const x of b.bookings ?? []) {
        await client.query(
          `insert into bookings (id, business_id, service_id, service_name, minutes, date, time, name, phone, notes, status, source, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict (id) do nothing`,
          [x.id, b.id, x.serviceId, x.serviceName, x.minutes, x.date, x.time, x.name, x.phone, x.notes ?? '', x.status, x.source, x.createdAt]
        );
      }
    }
    await client.query('commit');
    console.log(`✓ datos copiados: ${products.length} productos, ${businesses.length} negocios`);
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}

try {
  await client.connect();
  await migrate();
  if (process.argv.includes('--seed')) await seed();
  const { rows } = await client.query(
    `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`
  );
  console.log(`Tablas en la base de datos (${rows.length}): ${rows.map((r) => r.table_name).join(', ')}`);
} catch (err) {
  console.error('Error:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
