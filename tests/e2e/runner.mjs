#!/usr/bin/env node
/**
 * SATI 3D Tarot & Fortune-Telling E2E Test Suite Runner
 * 
 * Zero-dependency test runner utilizing Node.js built-in `node:test` and `node:test/reporters`.
 * Supports tier filtering (--tier=1,2,3,4) and regex filtering (--filter=...).
 * 
 * Usage:
 *   node tests/e2e/runner.mjs
 *   node tests/e2e/runner.mjs --tier=1
 *   node tests/e2e/runner.mjs --tier=2
 *   node tests/e2e/runner.mjs --tier=3
 *   node tests/e2e/runner.mjs --tier=4
 *   npm test
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SUITE_ROOT = __dirname;

const TIER_DIRS = {
  1: { dir: path.join(SUITE_ROOT, 'tier1-features'), name: 'Tier 1: Feature Coverage (Features 1–10)' },
  2: { dir: path.join(SUITE_ROOT, 'tier2-boundary'), name: 'Tier 2: Boundary & Corner Cases (Features 1–10)' },
  3: { dir: path.join(SUITE_ROOT, 'tier3-combinations'), name: 'Tier 3: Cross-Feature Combinations (Pairwise Interaction)' },
  4: { dir: path.join(SUITE_ROOT, 'tier4-scenarios'), name: 'Tier 4: Real-World Application Scenarios (End-to-End User Journeys)' }
};

function parseArgs(args) {
  const options = {
    tiers: [1, 2, 3, 4],
    filter: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--tier=')) {
      const val = arg.split('=')[1];
      options.tiers = val.split(',').map(n => parseInt(n.trim(), 10)).filter(n => [1, 2, 3, 4].includes(n));
    } else if (arg === '-t' && i + 1 < args.length) {
      const val = args[++i];
      options.tiers = val.split(',').map(n => parseInt(n.trim(), 10)).filter(n => [1, 2, 3, 4].includes(n));
    } else if (arg.startsWith('--filter=')) {
      options.filter = arg.split('=')[1];
    } else if (arg === '-f' && i + 1 < args.length) {
      options.filter = args[++i];
    }
  }

  return options;
}

function findTestFiles(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && (entry.name.endsWith('.test.mjs') || entry.name.endsWith('.test.js'))) {
      if (!filter || entry.name.includes(filter) || fullPath.includes(filter)) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(`
SATI 3D Tarot & Fortune-Telling E2E Test Suite Runner

Usage:
  node tests/e2e/runner.mjs [options]

Options:
  --tier=<1|2|3|4>    Run specific test tier(s), e.g. --tier=1 or --tier=1,2
  -t <1|2|3|4>        Shorthand for --tier
  --filter=<pattern>  Filter test filenames matching regex/string pattern
  -f <pattern>        Shorthand for --filter
  --help, -h          Show this help message

Examples:
  node tests/e2e/runner.mjs                  Run all 4 tiers
  node tests/e2e/runner.mjs --tier=1         Run Tier 1 only
  node tests/e2e/runner.mjs --tier=3,4       Run Tiers 3 & 4
  node tests/e2e/runner.mjs --filter=f01     Run tests matching f01
`);
    process.exit(0);
  }

  console.log('='.repeat(78));
  console.log('   SATI 3D TAROT & FORTUNE-TELLING — END-TO-END VERIFICATION SUITE');
  console.log('   Running on Node.js', process.version, '| Built-in node:test engine');
  console.log('='.repeat(78));

  const allFiles = [];
  for (const tierNum of options.tiers) {
    const tierMeta = TIER_DIRS[tierNum];
    if (!tierMeta) continue;
    const files = findTestFiles(tierMeta.dir, options.filter);
    console.log(`[Tier ${tierNum}] ${tierMeta.name}: ${files.length} test suite files found`);
    allFiles.push(...files);
  }

  if (allFiles.length === 0) {
    console.log('\n[WARNING] No test files matched the selected criteria.');
    process.exit(0);
  }

  console.log(`\nExecuting ${allFiles.length} test files across selected tiers...\n`);
  console.log('-'.repeat(78));

  const startTime = Date.now();
  let failedCount = 0;
  let passedCount = 0;

  const testStream = run({
    files: allFiles,
    concurrency: 1 // Run sequentially for deterministic WebGL & resource tracking
  });

  testStream.on('test:pass', (t) => {
    if (!t.nesting) passedCount++;
  });

  testStream.on('test:fail', (t) => {
    failedCount++;
  });

  testStream.compose(spec).pipe(process.stdout);

  await new Promise((resolve) => {
    testStream.on('end', resolve);
  });

  const durationMs = Date.now() - startTime;
  console.log('\n' + '='.repeat(78));
  console.log('   E2E EXECUTION SUMMARY');
  console.log('='.repeat(78));
  console.log(`   Total Duration:   ${(durationMs / 1000).toFixed(2)}s`);
  console.log(`   Suites Evaluated: ${allFiles.length}`);
  console.log(`   Exit Status:      ${failedCount === 0 ? 'SUCCESS [0]' : 'FAILURE [1]'}`);
  console.log('='.repeat(78) + '\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\n[FATAL] Test runner encountered an unhandled exception:', err);
  process.exit(1);
});
