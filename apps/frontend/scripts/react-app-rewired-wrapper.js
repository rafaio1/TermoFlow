#!/usr/bin/env node

const { spawnSync } = require('child_process');
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node scripts/react-app-rewired-wrapper.js <start|build|test> [args]');
  process.exit(1);
}

const major = parseInt(process.versions.node.split('.')[0], 10);
if (Number.isNaN(major)) {
  console.warn(`Unable to parse node version from "${process.versions.node}", leaving NODE_OPTIONS untouched.`);
} else if (major >= 17) {
  process.env.NODE_OPTIONS = '--openssl-legacy-provider';
} else {
  delete process.env.NODE_OPTIONS;
}

const result = spawnSync('react-app-rewired', args, { stdio: 'inherit' });
process.exit(result.status ?? 0);
