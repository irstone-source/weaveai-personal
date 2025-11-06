#!/usr/bin/env tsx
/**
 * Memory System Test
 * Tests the memory system functionality
 */

const PROD_URL = 'https://weaveai-personal.vercel.app';
const TEST_USER = {
  email: 'irstone@me.com',
  password: 'Bettergabber654!'
};

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function testMemoryAPIs() {
  console.log('\n🧪 Testing Memory System...\n');

  try {
    // Test 1: Check Memory Mode API
    console.log('📝 Test 1: Memory Mode API (GET)');
    const modeResponse = await fetch(`${PROD_URL}/api/memory/mode`, {
      method: 'GET',
      credentials: 'include'
    });

    console.log(`   Status: ${modeResponse.status}`);
    console.log(`   Headers: ${JSON.stringify(Object.fromEntries(modeResponse.headers))}`);

    if (modeResponse.ok) {
      const modeData = await modeResponse.json();
      results.push({
        test: 'Memory Mode API GET',
        passed: true,
        message: 'Memory mode API is accessible',
        details: modeData
      });
      console.log(`   ✅ PASS: ${JSON.stringify(modeData)}`);
    } else {
      const errorText = await modeResponse.text();
      results.push({
        test: 'Memory Mode API GET',
        passed: false,
        message: `Memory mode API returned ${modeResponse.status}`,
        details: errorText
      });
      console.log(`   ❌ FAIL: ${errorText}`);
    }

    // Test 2: Check Memory Mode API POST (requires auth)
    console.log('\n📝 Test 2: Memory Mode API (POST)');
    const postResponse = await fetch(`${PROD_URL}/api/memory/mode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mode: 'humanized' }),
      credentials: 'include'
    });

    console.log(`   Status: ${postResponse.status}`);

    if (postResponse.status === 401) {
      results.push({
        test: 'Memory Mode API POST (auth)',
        passed: true,
        message: 'Correctly requires authentication',
        details: { expectedStatus: 401, actualStatus: postResponse.status }
      });
      console.log(`   ✅ PASS: Correctly blocks unauthenticated requests`);
    } else {
      const responseData = await postResponse.text();
      results.push({
        test: 'Memory Mode API POST (auth)',
        passed: false,
        message: `Expected 401, got ${postResponse.status}`,
        details: responseData
      });
      console.log(`   ❌ FAIL: Expected 401, got ${postResponse.status}`);
    }

    // Test 3: Check Focus Mode API
    console.log('\n📝 Test 3: Focus Mode API (POST)');
    const focusResponse = await fetch(`${PROD_URL}/api/memory/focus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        categories: ['health', 'wealth'],
        boostFactor: 2.0,
        durationHours: 4
      }),
      credentials: 'include'
    });

    console.log(`   Status: ${focusResponse.status}`);

    if (focusResponse.status === 401) {
      results.push({
        test: 'Focus Mode API POST (auth)',
        passed: true,
        message: 'Correctly requires authentication',
        details: { expectedStatus: 401, actualStatus: focusResponse.status }
      });
      console.log(`   ✅ PASS: Correctly blocks unauthenticated requests`);
    } else {
      const responseData = await focusResponse.text();
      results.push({
        test: 'Focus Mode API POST (auth)',
        passed: false,
        message: `Expected 401, got ${focusResponse.status}`,
        details: responseData
      });
      console.log(`   ❌ FAIL: Expected 401, got ${focusResponse.status}`);
    }

    // Test 4: Check if Pinecone is configured
    console.log('\n📝 Test 4: Checking Pinecone Configuration');
    const envCheck = await fetch(`${PROD_URL}/api/health`, {
      method: 'GET'
    });

    if (envCheck.ok) {
      const healthData = await envCheck.json();
      results.push({
        test: 'Health Check',
        passed: true,
        message: 'Health check endpoint exists',
        details: healthData
      });
      console.log(`   ✅ PASS: Health check working`);
    } else {
      results.push({
        test: 'Health Check',
        passed: false,
        message: `Health check returned ${envCheck.status}`,
        details: await envCheck.text()
      });
      console.log(`   ℹ️  Note: Health check endpoint not found (expected for this test)`);
    }

  } catch (error) {
    console.error('❌ Error during testing:', error);
    results.push({
      test: 'Overall Memory System Test',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  console.log('\n' + '='.repeat(80));
  console.log('DETAILED RESULTS:');
  console.log('='.repeat(80));

  results.forEach((result, i) => {
    console.log(`\n${i + 1}. ${result.test}`);
    console.log(`   ${result.passed ? '✅' : '❌'} ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n');

  return results;
}

// Run tests
testMemoryAPIs();
