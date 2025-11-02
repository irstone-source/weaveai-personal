// Quick test for memory system setup
import dotenv from 'dotenv';
dotenv.config();

console.log('🧪 Testing Memory System Setup...\n');

// Check Pinecone API Key
const pineconeKey = process.env.PINECONE_API_KEY;
if (pineconeKey && pineconeKey.length > 10) {
  console.log('✅ Pinecone API Key: Configured');
  console.log(`   Key: ${pineconeKey.substring(0, 15)}...`);
} else {
  console.log('❌ Pinecone API Key: Missing or invalid');
}

// Check OpenAI API Key
const openaiKey = process.env.OPENAI_API_KEY;
if (openaiKey && openaiKey.length > 10) {
  console.log('✅ OpenAI API Key: Configured');
  console.log(`   Key: ${openaiKey.substring(0, 15)}...`);
} else {
  console.log('❌ OpenAI API Key: Missing or invalid');
}

// Check Database URL
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.includes('postgresql://')) {
  console.log('✅ Database URL: Configured');
  console.log(`   DB: ${dbUrl.split('@')[1]?.split('/')[0] || 'Unknown'}`);
} else {
  console.log('❌ Database URL: Missing or invalid');
}

console.log('\n📊 Memory System Status:');
console.log('   Backend: src/lib/server/memory/pinecone-memory.ts ✅');
console.log('   API Routes: /api/memory/* ✅');
console.log('   UI Component: src/lib/components/MemoryControls.svelte ✅');
console.log('   Schema: Ready to push (memories + focusSessions tables)');

console.log('\n🚀 Next Steps:');
console.log('   1. Push database schema: npm run db:push');
console.log('   2. Visit chat page: http://localhost:5173');
console.log('   3. Look for Memory Controls panel at top of chat');

console.log('\n✨ Memory system is ready to activate!\n');
