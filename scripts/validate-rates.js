import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateRatesPayload } from '../src/rates/validateRates.js';

const RATE_DIR = 'src/rates';

async function findRateFiles() {
  const entries = await readdir(RATE_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(RATE_DIR, entry.name))
    .sort();
}

const [, , ...requestedFiles] = process.argv;
const files = requestedFiles.length > 0 ? requestedFiles : await findRateFiles();
let hasFailure = false;

if (files.length === 0) {
  console.error(`FAIL no rate JSON files found in ${RATE_DIR}`);
  process.exit(1);
}

for (const file of files) {
  try {
    const payload = JSON.parse(await readFile(file, 'utf8'));
    const validation = validateRatesPayload(payload);
    if (validation.valid) {
      console.log(`OK ${file}`);
    } else {
      hasFailure = true;
      console.error(`FAIL ${file}`);
      for (const error of validation.errors) {
        console.error(`  - ${error}`);
      }
    }
  } catch (error) {
    hasFailure = true;
    console.error(`FAIL ${file}`);
    console.error(`  - ${error.message}`);
  }
}

if (hasFailure) {
  process.exit(1);
}
