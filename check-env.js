#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local explicitly
dotenv.config({ path: join(__dirname, '.env.local') });

console.log('🔍 Environment Variables Check\n');

const checks = [
  {
    name: 'TURSO_DATABASE_URL',
    value: process.env.TURSO_DATABASE_URL,
    expected: 'libsql://',
  },
  {
    name: 'TURSO_AUTH_TOKEN',
    value: process.env.TURSO_AUTH_TOKEN,
    expected: 'eyJ',
  },
];

let allGood = true;

checks.forEach(({ name, value, expected }) => {
  if (!value) {
    console.log(`❌ ${name}: NOT SET`);
    allGood = false;
  } else if (!value.startsWith(expected)) {
    console.log(`⚠️  ${name}: SET but might be incorrect`);
    console.log(`   Expected to start with: ${expected}`);
    console.log(`   Got: ${value.substring(0, 20)}...`);
    allGood = false;
  } else {
    console.log(`✅ ${name}: OK`);
  }
});

console.log('\n' + '='.repeat(50));

if (allGood) {
  console.log('✅ All environment variables are configured correctly!');
  console.log('\nYou can now run:');
  console.log('  npm run server  (in one terminal)');
  console.log('  npm run dev     (in another terminal)');
} else {
  console.log('❌ Please update your .env.local file with correct values');
  console.log('\nSee SETUP.md for instructions.');
}

console.log('='.repeat(50) + '\n');
