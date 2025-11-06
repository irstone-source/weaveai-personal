#!/usr/bin/env tsx
/**
 * Test Progress Monitor
 * Displays real-time progress of the 100-iteration test suite
 */

import { readFileSync, existsSync } from 'fs';
import { exec } from 'child_process';

function clearScreen() {
  console.clear();
}

function getLatestTestSummary(): string {
  try {
    if (existsSync('./test-summary.txt')) {
      return readFileSync('./test-summary.txt', 'utf-8');
    }
    return 'No test results yet...';
  } catch (error) {
    return `Error reading test summary: ${error}`;
  }
}

function displayDashboard() {
  clearScreen();

  const summary = getLatestTestSummary();
  const lines = summary.split('\n');

  // Extract key metrics
  const startedLine = lines.find(l => l.includes('Started at'));
  const latestIteration = lines.filter(l => l.startsWith('Iteration')).pop();

  console.log(`
${'█'.repeat(100)}
                    🚀 WEAVE AI - 100-ITERATION TEST MONITOR 🚀
${'█'.repeat(100)}

${startedLine || 'Test run not started'}

${latestIteration ? `
${' '.repeat(30)}LATEST ITERATION
${' '.repeat(30)}${'─'.repeat(40)}
${lines.slice(lines.lastIndexOf(latestIteration), lines.lastIndexOf(latestIteration) + 10).join('\n')}
` : 'Waiting for first iteration...'}

${'─'.repeat(100)}

📊 Full Test Summary:
${'─'.repeat(100)}

${summary.slice(-2000)} // Last 2000 characters

${'─'.repeat(100)}
⏰ Last updated: ${new Date().toLocaleTimeString()}
🔄 Refreshing every 10 seconds... (Press Ctrl+C to exit)
${'─'.repeat(100)}
`);
}

// Display dashboard immediately
displayDashboard();

// Update every 10 seconds
setInterval(displayDashboard, 10000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n✨ Monitor stopped\n');
  process.exit(0);
});
