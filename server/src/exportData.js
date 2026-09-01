// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Export the local database + uploads for a teammate
// ============================================================
// Usage: npm run db:export
//
// Produces ONE folder, `rentalflow-export/`, holding both halves of the data:
//
//   data.sql     a pg_dump of the whole database
//   uploads/     the product photos and NID images
//
// Both are needed. The database stores only the PATH of an uploaded file
// (`/uploads/1788….png`); the file itself lives on disk. Sending the SQL dump
// on its own leaves your teammate with every image broken.
//
// The dump is taken through `docker exec`, so nobody needs Postgres installed
// locally — only the same Docker container the whole team already runs.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUT_DIR = path.join(REPO_ROOT, 'rentalflow-export');

const CONTAINER = process.env.RENTALFLOW_CONTAINER || 'rentalflow-db';
const DB_USER = process.env.RENTALFLOW_DB_USER || 'rentalflow';
const DB_NAME = process.env.RENTALFLOW_DB_NAME || 'rentalflow';

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024, ...opts });
}

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
  // Confirm the container is actually up before doing anything else, so the
  // failure message is "start Docker" rather than a wall of pg_dump output.
  try {
    run('docker', ['inspect', '-f', '{{.State.Running}}', CONTAINER]);
  } catch {
    console.error(`X Container "${CONTAINER}" is not running.`);
    console.error('  Start it first:  docker compose up -d');
    process.exit(1);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // --- 1. the database ---
  // --clean --if-exists so importing over an existing database replaces it
  // rather than failing on "already exists"; --no-owner so the roles on the
  // other machine do not have to match ours.
  const dump = run('docker', [
    'exec', CONTAINER,
    'pg_dump', '-U', DB_USER, '-d', DB_NAME,
    '--clean', '--if-exists', '--no-owner', '--no-privileges',
  ]);
  const sqlPath = path.join(OUT_DIR, 'data.sql');
  fs.writeFileSync(sqlPath, dump);

  // --- 2. the uploaded files ---
  const fileCount = copyDir(UPLOAD_DIR, path.join(OUT_DIR, 'uploads'));

  // --- 3. a note for whoever receives it ---
  fs.writeFileSync(path.join(OUT_DIR, 'READ-ME.txt'), `RentalFlow data export
Taken on ${new Date().toISOString().slice(0, 16).replace('T', ' ')}

WHAT IS IN HERE
  data.sql    full database dump (users, items, bookings, everything)
  uploads/    ${fileCount} uploaded files - product photos and NID images

BOTH ARE NEEDED. The database only stores the path of an image
("/uploads/1788....png"); the file itself lives in uploads/. Loading the SQL
without copying the files leaves every image broken.

HOW TO LOAD IT

  1. Put this folder in the repository root, next to client/ and server/.
  2. Make sure the database container is running:
       docker compose up -d
  3. From the repository root:
       npm --prefix server run db:import

  That replaces your local database with this one and copies the files into
  server/src/uploads/.

PRIVACY - PLEASE READ
  This dump contains real personal data: bcrypt password hashes, National ID
  numbers, and photographs of ID cards. Send it directly to your teammate
  (Drive/WhatsApp), keep it out of git, and delete it when you are done.
  It is already listed in .gitignore.
`);

  const sizeMb = (n) => (n / 1024 / 1024).toFixed(1);
  const uploadsBytes = fs.existsSync(path.join(OUT_DIR, 'uploads'))
    ? fs.readdirSync(path.join(OUT_DIR, 'uploads'))
      .reduce((sum, f) => sum + fs.statSync(path.join(OUT_DIR, 'uploads', f)).size, 0)
    : 0;

  console.log('Export complete ->', path.relative(REPO_ROOT, OUT_DIR));
  console.log(`   data.sql   ${sizeMb(fs.statSync(sqlPath).size)} MB`);
  console.log(`   uploads/   ${fileCount} files, ${sizeMb(uploadsBytes)} MB`);
  console.log('');
  console.log('   Zip that folder and send it to your teammate.');
  console.log('   They run:  npm --prefix server run db:import');
  console.log('');
  console.log('   NOTE: it contains password hashes, NID numbers and ID card');
  console.log('   photos. Send it directly, do not commit it, delete when done.');
}

main();
