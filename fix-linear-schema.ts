/**
 * Fix Linear Schema - Make linearProjectId nullable
 */
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error('❌ DATABASE_URL required');
	process.exit(1);
}

async function fixSchema() {
	const sql = postgres(DATABASE_URL);

	try {
		console.log('🔧 Making linearProjectId nullable...');

		await sql`ALTER TABLE linear_issue ALTER COLUMN "linearProjectId" DROP NOT NULL`;

		console.log('✅ Successfully made linearProjectId nullable');
		console.log('   Issues can now be inserted without a project');

	} catch (error: any) {
		console.error('❌ Error:', error.message);
		throw error;
	} finally {
		await sql.end();
	}
}

fixSchema()
	.then(() => process.exit(0))
	.catch(() => process.exit(1));
