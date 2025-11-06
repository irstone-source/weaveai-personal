#!/usr/bin/env tsx
import { config } from 'dotenv';
import fetch from 'node-fetch';

config();

const PRODUCTION_URL = 'https://weaveai-personal-gz9pf5nqp-ians-projects-4358fa58.vercel.app';

interface TestResult {
  test: string;
  success: boolean;
  error?: string;
  details?: any;
  timestamp: string;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const status = result.success ? '✅' : '❌';
  console.log(`${status} ${result.test}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
  if (result.details) {
    console.log(`   Details:`, JSON.stringify(result.details, null, 2));
  }
}

async function testAPIEndpoint(endpoint: string, options: any = {}) {
  try {
    const response = await fetch(`${PRODUCTION_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    return { response, data };
  } catch (error) {
    throw new Error(`Network error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runTests() {
  console.log('🧪 Starting Chat System Tests\n');
  console.log(`Testing: ${PRODUCTION_URL}\n`);
  console.log('=' .repeat(80));

  // Test 1: Check if API keys are configured
  console.log('\n📋 Test 1: Environment Variables Check');
  try {
    const { response, data } = await testAPIEndpoint('/api/health');
    logResult({
      test: 'Health check endpoint',
      success: response.ok,
      details: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logResult({
      test: 'Health check endpoint',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }

  // Test 2: Test authentication
  console.log('\n📋 Test 2: Authentication Check');
  try {
    const { response, data } = await testAPIEndpoint('/api/auth/session');
    logResult({
      test: 'Session endpoint (unauthenticated)',
      success: response.status === 401 || response.ok,
      details: { status: response.status, data },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logResult({
      test: 'Session endpoint',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }

  // Test 3: Test chat creation (should fail without auth)
  console.log('\n📋 Test 3: Chat API Authorization');
  try {
    const { response, data } = await testAPIEndpoint('/api/chats', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Chat',
      }),
    });
    logResult({
      test: 'Chat creation (unauthenticated)',
      success: response.status === 401,
      details: { status: response.status, data },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logResult({
      test: 'Chat creation endpoint',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }

  // Test 4: Check AI models endpoint
  console.log('\n📋 Test 4: AI Models Configuration');
  try {
    const { response, data } = await testAPIEndpoint('/api/models');
    logResult({
      test: 'AI models endpoint',
      success: response.ok && Array.isArray(data),
      details: {
        status: response.status,
        modelCount: Array.isArray(data) ? data.length : 0,
        models: Array.isArray(data) ? data.map((m: any) => m.name || m.displayName) : []
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logResult({
      test: 'AI models endpoint',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Test Summary');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  console.log('\n📝 Detailed Results:');
  results.forEach((result, i) => {
    console.log(`\n${i + 1}. ${result.test}`);
    console.log(`   Status: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Time: ${result.timestamp}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(80));

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
