#!/usr/bin/env tsx
/**
 * 100-Iteration Testing Script
 * Runs comprehensive tests on the app for 100 iterations over 8 hours
 * Tests chat functionality, API endpoints, authentication, and AI model integration
 */

import { config } from 'dotenv';
import fetch from 'node-fetch';
import { writeFileSync, appendFileSync } from 'fs';

config();

const PRODUCTION_URL = 'https://weaveai-personal-gz9pf5nqp-ians-projects-4358fa58.vercel.app';
const ITERATIONS = 100;
const DURATION_HOURS = 8;
const DELAY_BETWEEN_ITERATIONS = (DURATION_HOURS * 60 * 60 * 1000) / ITERATIONS; // ~288 seconds per iteration

interface TestResult {
  iteration: number;
  timestamp: string;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  successRate: number;
  duration: number;
  errors: string[];
  details: any;
}

const allResults: TestResult[] = [];
const logFile = './test-results-' + new Date().toISOString().replace(/:/g, '-') + '.json';
const summaryFile = './test-summary.txt';

// Initialize log files
writeFileSync(logFile, '[\n');
writeFileSync(summaryFile, `100-Iteration Test Run Started at ${new Date().toISOString()}\n\n`);

async function testAPIEndpoint(endpoint: string, options: any = {}) {
  try {
    const response = await fetch(`${PRODUCTION_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return { response, data };
  } catch (error) {
    throw new Error(`Network error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runIterationTests(iteration: number): Promise<TestResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 Iteration ${iteration}/${ITERATIONS} - ${new Date().toLocaleTimeString()}`);
  console.log(`${'='.repeat(80)}\n`);

  const startTime = Date.now();
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];
  const details: any = {};

  // Test 1: Models API
  try {
    const { response, data } = await testAPIEndpoint('/api/models');
    if (response.ok && typeof data === 'object' && Array.isArray(data.models)) {
      passed++;
      details.models = {
        count: data.models.length,
        providers: [...new Set(data.models.map((m: any) => m.provider))],
      };
      console.log(`✅ Models API - ${data.models.length} models available`);
    } else {
      failed++;
      errors.push('Models API returned invalid response');
      console.log(`❌ Models API - invalid response`);
    }
  } catch (error) {
    failed++;
    errors.push(`Models API: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`❌ Models API - ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 2: Chat Creation (unauthenticated - should fail with 401)
  try {
    const { response, data } = await testAPIEndpoint('/api/chats', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Chat' }),
    });
    if (response.status === 401) {
      passed++;
      console.log(`✅ Chat API Authorization - correctly blocking unauthenticated requests`);
    } else {
      failed++;
      errors.push(`Chat API returned unexpected status: ${response.status}`);
      console.log(`❌ Chat API - unexpected status ${response.status}`);
    }
  } catch (error) {
    failed++;
    errors.push(`Chat API: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`❌ Chat API - ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 3: Homepage availability
  try {
    const { response } = await testAPIEndpoint('/');
    if (response.ok) {
      passed++;
      console.log(`✅ Homepage - loading successfully`);
    } else {
      failed++;
      errors.push(`Homepage returned status: ${response.status}`);
      console.log(`❌ Homepage - status ${response.status}`);
    }
  } catch (error) {
    failed++;
    errors.push(`Homepage: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`❌ Homepage - ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 4: Static assets
  try {
    const { response } = await testAPIEndpoint('/branding/favicon/default-favicon.png');
    if (response.ok) {
      passed++;
      console.log(`✅ Static Assets - loading correctly`);
    } else {
      failed++;
      errors.push(`Static assets returned status: ${response.status}`);
      console.log(`❌ Static Assets - status ${response.status}`);
    }
  } catch (error) {
    failed++;
    errors.push(`Static assets: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`❌ Static Assets - ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 5: Response time check
  const responseTime = Date.now() - startTime;
  if (responseTime < 5000) {
    passed++;
    details.responseTime = responseTime;
    console.log(`✅ Response Time - ${responseTime}ms (acceptable)`);
  } else {
    failed++;
    errors.push(`Slow response time: ${responseTime}ms`);
    details.responseTime = responseTime;
    console.log(`⚠️  Response Time - ${responseTime}ms (slow)`);
  }

  const duration = Date.now() - startTime;
  const testsRun = passed + failed;
  const successRate = testsRun > 0 ? (passed / testsRun) * 100 : 0;

  const result: TestResult = {
    iteration,
    timestamp: new Date().toISOString(),
    testsRun,
    testsPassed: passed,
    testsFailed: failed,
    successRate,
    duration,
    errors,
    details,
  };

  // Log summary
  console.log(`\n📊 Iteration ${iteration} Summary:`);
  console.log(`   Tests: ${passed}/${testsRun} passed (${successRate.toFixed(1)}%)`);
  console.log(`   Duration: ${duration}ms`);
  if (errors.length > 0) {
    console.log(`   Errors: ${errors.length}`);
  }

  return result;
}

async function runAllTests() {
  console.log(`\n${'█'.repeat(80)}`);
  console.log(`🚀 Starting 100-Iteration Test Suite`);
  console.log(`   Duration: ${DURATION_HOURS} hours`);
  console.log(`   Interval: ${(DELAY_BETWEEN_ITERATIONS / 1000).toFixed(0)} seconds between iterations`);
  console.log(`   Target: ${PRODUCTION_URL}`);
  console.log(`${'█'.repeat(80)}\n`);

  for (let i = 1; i <= ITERATIONS; i++) {
    const result = await runIterationTests(i);
    allResults.push(result);

    // Save result to log file
    const resultJson = JSON.stringify(result, null, 2);
    appendFileSync(logFile, (i > 1 ? ',\n' : '') + resultJson);

    // Update summary file
    const summary = `
Iteration ${i}/${ITERATIONS} - ${new Date().toLocaleTimeString()}
${'-'.repeat(50)}
Success Rate: ${result.successRate.toFixed(1)}%
Tests Passed: ${result.testsPassed}/${result.testsRun}
Duration: ${result.duration}ms
${result.errors.length > 0 ? `Errors: ${result.errors.join(', ')}` : 'No errors'}

`;
    appendFileSync(summaryFile, summary);

    // Calculate overall statistics
    const overallPassed = allResults.reduce((sum, r) => sum + r.testsPassed, 0);
    const overallTests = allResults.reduce((sum, r) => sum + r.testsRun, 0);
    const overallSuccessRate = (overallPassed / overallTests) * 100;
    const avgDuration = allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length;

    console.log(`\n📈 Overall Progress: ${i}/${ITERATIONS} iterations complete`);
    console.log(`   Success Rate: ${overallSuccessRate.toFixed(1)}%`);
    console.log(`   Avg Duration: ${avgDuration.toFixed(0)}ms`);

    // Wait before next iteration (unless it's the last one)
    if (i < ITERATIONS) {
      const nextTime = new Date(Date.now() + DELAY_BETWEEN_ITERATIONS);
      console.log(`\n⏳ Next iteration in ${(DELAY_BETWEEN_ITERATIONS / 1000).toFixed(0)}s (at ${nextTime.toLocaleTimeString()})`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_ITERATIONS));
    }
  }

  // Close log file
  appendFileSync(logFile, '\n]');

  // Final summary
  const overallPassed = allResults.reduce((sum, r) => sum + r.testsPassed, 0);
  const overallTests = allResults.reduce((sum, r) => sum + r.testsRun, 0);
  const overallSuccessRate = (overallPassed / overallTests) * 100;
  const avgDuration = allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length;
  const totalErrors = allResults.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(`\n${'█'.repeat(80)}`);
  console.log(`🏁 100-Iteration Test Suite Complete!`);
  console.log(`${'█'.repeat(80)}\n`);
  console.log(`📊 Final Statistics:`);
  console.log(`   Total Tests Run: ${overallTests}`);
  console.log(`   Tests Passed: ${overallPassed}`);
  console.log(`   Tests Failed: ${overallTests - overallPassed}`);
  console.log(`   Overall Success Rate: ${overallSuccessRate.toFixed(1)}%`);
  console.log(`   Average Duration: ${avgDuration.toFixed(0)}ms`);
  console.log(`   Total Errors: ${totalErrors}`);
  console.log(`\n📁 Results saved to:`);
  console.log(`   Detailed: ${logFile}`);
  console.log(`   Summary: ${summaryFile}`);
  console.log(`\n✨ Test run completed at ${new Date().toLocaleTimeString()}\n`);

  // Write final summary
  const finalSummary = `
${'='.repeat(80)}
FINAL TEST SUMMARY
${'='.repeat(80)}

Test Run: ${new Date().toISOString()}
Duration: ${DURATION_HOURS} hours
Iterations: ${ITERATIONS}

RESULTS:
--------
Total Tests Run: ${overallTests}
Tests Passed: ${overallPassed}
Tests Failed: ${overallTests - overallPassed}
Overall Success Rate: ${overallSuccessRate.toFixed(1)}%
Average Duration: ${avgDuration.toFixed(0)}ms
Total Errors: ${totalErrors}

${overallSuccessRate >= 95 ? '✅ EXCELLENT - System is highly reliable!' : ''}
${overallSuccessRate >= 80 && overallSuccessRate < 95 ? '✓ GOOD - System is generally reliable with minor issues' : ''}
${overallSuccessRate < 80 ? '⚠️ ATTENTION NEEDED - System has significant issues' : ''}

`;
  appendFileSync(summaryFile, finalSummary);

  process.exit(overallSuccessRate >= 80 ? 0 : 1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Test run interrupted by user');
  appendFileSync(logFile, '\n]');
  appendFileSync(summaryFile, `\n\nTest run interrupted at iteration ${allResults.length}/${ITERATIONS}\n`);
  process.exit(1);
});

// Start the test suite
runAllTests().catch(error => {
  console.error('❌ Fatal error in test suite:', error);
  process.exit(1);
});
