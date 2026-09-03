import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');
const translationsDirectory = path.join(root, 'src', 'locale', 'translations');
const englishPath = path.join(translationsDirectory, 'en.json');

if (!fs.existsSync(englishPath)) {
  console.error('Locale check failed: src/locale/translations/en.json is missing.');
  process.exit(1);
}

const english = readDictionary(englishPath);
const baselineKeys = Object.keys(english).sort();
const translationFiles = fs
  .readdirSync(translationsDirectory)
  .filter(file => file.endsWith('.json'))
  .sort();

const violations = [];
for (const file of translationFiles) {
  const dictionary = readDictionary(path.join(translationsDirectory, file));
  const keys = Object.keys(dictionary).sort();
  const missing = baselineKeys.filter(key => !Object.hasOwn(dictionary, key));
  const extra = keys.filter(key => !Object.hasOwn(english, key));
  const empty = keys.filter(key => dictionary[key].trim().length === 0);

  if (missing.length > 0) {
    violations.push(`${file}: missing keys: ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    violations.push(`${file}: extra keys: ${extra.join(', ')}`);
  }
  if (empty.length > 0) {
    violations.push(`${file}: empty values: ${empty.join(', ')}`);
  }
}

if (violations.length > 0) {
  console.error('Locale check failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(
  `Locale check passed: ${translationFiles.length} dictionaries share ${baselineKeys.length} keys.`,
);

function readDictionary(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Locale dictionary must be a JSON object: ${filePath}`);
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') {
      throw new Error(`Locale value must be a string: ${filePath} -> ${key}`);
    }
  }

  return parsed;
}
