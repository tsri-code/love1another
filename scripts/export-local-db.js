#!/usr/bin/env node
/**
 * Export local SQLite database to JSON for Turso migration
 * Run with: node scripts/export-local-db.js
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), '.prayer-data');
const DB_PATH = path.join(DATA_DIR, 'prayers.db');
const OUTPUT_PATH = path.join(process.cwd(), 'scripts', 'db-export.json');

if (!fs.existsSync(DB_PATH)) {
  console.error('No local database found at:', DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH);

// Export all tables
const exportData = {
  exportedAt: new Date().toISOString(),
  people: [],
  links: [],
  masterSettings: [],
};

// Export people (convert Buffer to base64)
const people = db.prepare('SELECT * FROM people').all();
exportData.people = people.map(p => ({
  ...p,
  prayerDataEncrypted: p.prayerDataEncrypted ? p.prayerDataEncrypted.toString('base64') : null,
}));
console.log(`Exported ${exportData.people.length} people`);

// Export links
try {
  const links = db.prepare('SELECT * FROM links').all();
  exportData.links = links.map(l => ({
    ...l,
    prayerDataEncrypted: l.prayerDataEncrypted ? l.prayerDataEncrypted.toString('base64') : null,
  }));
  console.log(`Exported ${exportData.links.length} links`);
} catch (e) {
  console.log('No links table or empty');
}

// Export master settings
try {
  const settings = db.prepare('SELECT * FROM master_settings').all();
  exportData.masterSettings = settings;
  console.log(`Exported ${exportData.masterSettings.length} master settings`);
} catch (e) {
  console.log('No master_settings table or empty');
}

// Write to file
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(exportData, null, 2));
console.log(`\nExported to: ${OUTPUT_PATH}`);
console.log('\nNow run the import script after setting up Turso:');
console.log('  node scripts/import-to-turso.js');

