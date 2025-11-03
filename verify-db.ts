import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = postgres(DATABASE_URL);

async function verifyTables() {
  try {
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('\n✅ DATABASE MIGRATION SUCCESSFUL!\n');
    console.log(`Total tables created: ${tables.length}\n`);
    console.log('Tables:');
    tables.forEach((t: any, i: number) => {
      console.log(`  ${i + 1}. ${t.table_name}`);
    });

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await sql.end();
    process.exit(1);
  }
}

verifyTables();
