// Phase 0 Automated Verification Script
import fs from 'fs';
import path from 'path';

const requiredDirs = [
  'app',
  'src-tauri',
  'core',
  'ai',
  'rag',
  'sync',
  'database',
  'documents',
  'models',
  'tests',
  'docs',
  'scripts'
];

console.log('--- Offline Study AI Phase 0 Verification ---');
let missing = 0;

for (const dir of requiredDirs) {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    console.log(`✓ Directory verified: ${dir}/`);
  } else {
    console.error(`✗ Missing directory: ${dir}/`);
    missing++;
  }
}

if (fs.existsSync(path.join(process.cwd(), 'database/schema.sql'))) {
  console.log('✓ SQLite schema file verified (database/schema.sql)');
} else {
  console.error('✗ Missing database/schema.sql');
  missing++;
}

if (fs.existsSync(path.join(process.cwd(), 'AGENTS.md'))) {
  console.log('✓ Project rules verified (AGENTS.md)');
} else {
  console.error('✗ Missing AGENTS.md');
  missing++;
}

if (missing === 0) {
  console.log('\nSUCCESS: All Phase 0 architectural components are verified!');
  process.exit(0);
} else {
  console.error(`\nFAILURE: ${missing} required items missing.`);
  process.exit(1);
}
