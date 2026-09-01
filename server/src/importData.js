// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Load a teammate's exported data
// ============================================================
// Usage: npm run db:import
//
// Reads `rentalflow-export/` from the repository root and restores both halves:
// the database from data.sql, and the uploaded files into server/src/uploads/.
//
// This REPLACES your local database. The dump is taken with --clean, so every
// table is dropped and recreated. Anything you had locally is gone.
import fs from 'fs';
import path from 'path';
import { execFileSync, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const IN_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(REPO_ROOT, 'rentalflow-export');

const CONTAINER = process.env.RENTALFLOW_CONTAINER || 'rentalflow-db';
const DB_USER = process.env.RENTALFLOW_DB_USER || 'rentalflow';
const DB_NAME = process.env.RENTALFLOW_DB_NAME || 'rentalflow';

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) n += copyDir(src, dst);
    else { fs.copyFileSync(src, dst); n += 1; }
  }
  return n;
}

function main() {
  const sqlPath = path.join(IN_DIR, 'data.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`X No export found at ${path.relative(REPO_ROOT, IN_DIR) || IN_DIR}`);
    console.error('  Put the rentalflow-export folder in the repository root,');
    console.error('  or pass its path:  node src/importData.js ../some/other/folder');
    process.exit(1);
  }

  try {
    execFileSync('docker', ['inspect', '-f', '{{.State.Running}}', CONTAINER]);
  } catch {
    console.error(`X Container "${CONTAINER}" is not running.`);
    console.error('  Start it first:  docker compose up -d');
    process.exit(1);
  }

  // --- 1. the database ---
  // Piped through stdin rather than a mounted file, so it works the same on
  // Windows, macOS and Linux without worrying about path translation.
  console.log('Restoring the database...');
  execSync(
    `docker exec -i ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -v ON_ERROR_STOP=0 -q`,
    { input: fs.readFileSync(sqlPath), stdio: ['pipe', 'inherit', 'pipe'], maxBuffer: 512 * 1024 * 1024 }
  );

  // --- 2. the uploaded files ---
  const fileCount = copyDir(path.join(IN_DIR, 'uploads'), UPLOAD_DIR);

  console.log('');
  console.log('Import complete.');
  console.log(`   database   restored from ${path.relative(REPO_ROOT, sqlPath)}`);
  console.log(`   uploads    ${fileCount} files copied into server/src/uploads/`);
  console.log('');
  console.log('   Restart the API so it picks up the new data:  npm start');
}

main();
