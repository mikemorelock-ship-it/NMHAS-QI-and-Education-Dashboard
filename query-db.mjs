import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'dev.db');
const db = new Database(dbPath);

console.log('\n=== DIVISIONS ===');
const divisions = db.prepare('SELECT id, name, slug FROM Division').all();
divisions.forEach(d => console.log(d));

console.log('\n=== REGIONS (Departments in UI) ===');
const regions = db.prepare(\).all();
regions.forEach(r => console.log(r));

console.log('\n=== METRIC ASSOCIATIONS ===');
const associations = db.prepare(\).all();
associations.forEach(a => console.log(a));

console.log('\n=== CHECKING QUALITY REGION ===');
const qualityRegion = db.prepare('SELECT id, name, divisionId FROM Individual WHERE name = ?').get('Quality');
if (qualityRegion) {
  console.log('Found Quality region:', qualityRegion);
  console.log('\nMetric entries for Quality:');
  const entries = db.prepare(\C:\Program Files\Git\usr\bin\[.exe).all(qualityRegion.id);
  entries.forEach(e => console.log(e));
} else {
  console.log('Quality region NOT found');
}

console.log('\n=== CHECKING ANCILLARY SERVICES ===');
const ancDiv = db.prepare('SELECT id, name, slug FROM Division WHERE name LIKE ?').get('%Ancillary%');
if (ancDiv) {
  console.log('Ancillary Services:', ancDiv);
  console.log('\nMetric Associations for Ancillary Services:');
  const ancAssociations = db.prepare(\C:\Program Files\Git\usr\bin\[.exe).all(ancDiv.id);
  ancAssociations.forEach(a => console.log(a));
}

db.close();
