import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbUrl;
let authToken;
try {
  const envContent = readFileSync(path.join(__dirname, ".env"), "utf-8");
  const urlMatch = envContent.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  dbUrl = urlMatch ? urlMatch[1] : `file:${path.join(__dirname, "dev.db")}`;
  const tokenMatch = envContent.match(/^TURSO_AUTH_TOKEN="?([^"\r\n]+)"?/m);
  authToken = tokenMatch ? tokenMatch[1] : undefined;
} catch {
  dbUrl = `file:${path.join(__dirname, "dev.db")}`;
}

const db = createClient({ url: dbUrl, authToken });

console.log('\n=== DIVISIONS ===');
const divisions = await db.execute('SELECT id, name, slug FROM Division');
divisions.rows.forEach(d => console.log(d));

console.log('\n=== REGIONS (Departments in UI) ===');
const regions = await db.execute(`SELECT id, name, slug, divisionId FROM Department`);
regions.rows.forEach(r => console.log(r));

console.log('\n=== METRIC ASSOCIATIONS ===');
const associations = await db.execute(`SELECT md.id, md.name, md.departmentId, d.name as deptName FROM MetricDefinition md JOIN Department d ON md.departmentId = d.id`);
associations.rows.forEach(a => console.log(a));

console.log('\n=== CHECKING QUALITY REGION ===');
const qualityRegion = await db.execute({ sql: 'SELECT id, name, divisionId FROM Individual WHERE name = ?', args: ['Quality'] });
if (qualityRegion.rows.length > 0) {
  const qr = qualityRegion.rows[0];
  console.log('Found Quality region:', qr);
  console.log('\nMetric entries for Quality:');
  const entries = await db.execute({ sql: `SELECT me.id, me.value, me.periodStart, md.name as metricName FROM MetricEntry me JOIN MetricDefinition md ON me.metricDefinitionId = md.id WHERE me.individualId = ?`, args: [qr.id] });
  entries.rows.forEach(e => console.log(e));
} else {
  console.log('Quality region NOT found');
}

console.log('\n=== CHECKING ANCILLARY SERVICES ===');
const ancDiv = await db.execute({ sql: 'SELECT id, name, slug FROM Division WHERE name LIKE ?', args: ['%Ancillary%'] });
if (ancDiv.rows.length > 0) {
  const ad = ancDiv.rows[0];
  console.log('Ancillary Services:', ad);
  console.log('\nMetric Associations for Ancillary Services:');
  const ancAssociations = await db.execute({ sql: `SELECT md.id, md.name, md.departmentId, d.name as deptName FROM MetricDefinition md JOIN Department d ON md.departmentId = d.id WHERE d.divisionId = ?`, args: [ad.id] });
  ancAssociations.rows.forEach(a => console.log(a));
}

db.close();
