// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: reading the text printed on the NID card
// ============================================================
// Tesseract (open-source OCR) compiled to WebAssembly via tesseract.js. The
// English model ships inside node_modules (@tesseract.js-data/eng), so nothing
// is downloaded at runtime — it works offline and on Vercel.
//
// The Bangladeshi smart card prints the name, date of birth and NID number in
// English, which is all the check needs; the Bangla lines are simply ignored.
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    const { createWorker } = require('tesseract.js');
    // The "best_int" model: the most accurate English model in a 3 MB file.
    const langPath = path.join(
      path.dirname(require.resolve('@tesseract.js-data/eng/package.json')),
      '4.0.0_best_int'
    );
    workerPromise = createWorker('eng', 1, {
      langPath,
      gzip: true,
      cachePath: os.tmpdir(),   // the only writable folder on a serverless host
    }).catch((err) => { workerPromise = null; throw err; });
  }
  return workerPromise;
}

// JPEG bytes → the text Tesseract read, line by line.
export async function readText(buffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return data.text || '';
}
