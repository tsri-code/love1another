#!/usr/bin/env node
/**
 * Import local database export to Turso
 * Run with: node scripts/import-to-turso.js
 * 
 * Requires environment variables:
 * - TURSO_DATABASE_URL
 * - TURSO_AUTH_TOKEN
 */

const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

const EXPORT_PATH = path.join(process.cwd(), 'scripts', 'db-export.json');

async function main() {
  // Check environment variables
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
  
  if (!tursoUrl || !tursoAuthToken) {
    console.error('Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables are required');
    console.error('');
    console.error('Steps to set up Turso:');
    console.error('1. Install Turso CLI: curl -sSfL https://get.tur.so/install.sh | bash');
    console.error('2. Sign up/login: turso auth login');
    console.error('3. Create database: turso db create love1another');
    console.error('4. Get URL: turso db show love1another --url');
    console.error('5. Get token: turso db tokens create love1another');
    console.error('6. Set env vars: export TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..."');
    console.error('7. Run this script again');
    process.exit(1);
  }
  
  // Check export file
  if (!fs.existsSync(EXPORT_PATH)) {
    console.error('Error: Export file not found at', EXPORT_PATH);
    console.error('Run "node scripts/export-local-db.js" first');
    process.exit(1);
  }
  
  // Read export data
  const exportData = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf-8'));
  console.log(`Read export from ${exportData.exportedAt}`);
  console.log(`- ${exportData.people.length} people`);
  console.log(`- ${exportData.links.length} links`);
  console.log(`- ${exportData.masterSettings.length} master settings`);
  
  // Connect to Turso
  const db = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });
  
  console.log('\nConnected to Turso');
  
  // Create tables
  console.log('\nCreating tables...');
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      displayName TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('person', 'group')),
      avatarPath TEXT,
      avatarInitials TEXT,
      avatarColor TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      passcodeHash TEXT NOT NULL,
      passcodeEncrypted TEXT,
      prayerDataEncrypted TEXT,
      verseId INTEGER NOT NULL,
      prayerCount INTEGER DEFAULT 0,
      lastPrayedAt TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      person1Id TEXT NOT NULL,
      person2Id TEXT NOT NULL,
      displayName TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      person1KeyEncrypted TEXT,
      person2KeyEncrypted TEXT,
      prayerDataEncrypted TEXT,
      verseId INTEGER NOT NULL,
      prayerCount INTEGER DEFAULT 0,
      lastPrayedAt TEXT,
      FOREIGN KEY (person1Id) REFERENCES people(id) ON DELETE CASCADE,
      FOREIGN KEY (person2Id) REFERENCES people(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS master_settings (
      id TEXT PRIMARY KEY,
      masterPasscodeHash TEXT NOT NULL,
      webauthnCredentials TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      personId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL,
      lastActivityAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      personId TEXT PRIMARY KEY,
      attempts INTEGER DEFAULT 0,
      lastAttemptAt TEXT,
      lockedUntil TEXT
    )
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_personId ON sessions(personId)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_links_person1 ON links(person1Id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_links_person2 ON links(person2Id)`);

  console.log('Tables created');
  
  // Import people
  console.log('\nImporting people...');
  for (const person of exportData.people) {
    try {
      await db.execute({
        sql: `
          INSERT OR REPLACE INTO people 
          (id, displayName, type, avatarPath, avatarInitials, avatarColor, createdAt, updatedAt, 
           passcodeHash, passcodeEncrypted, prayerDataEncrypted, verseId, prayerCount, lastPrayedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          person.id,
          person.displayName,
          person.type,
          person.avatarPath,
          person.avatarInitials,
          person.avatarColor,
          person.createdAt,
          person.updatedAt,
          person.passcodeHash,
          person.passcodeEncrypted,
          person.prayerDataEncrypted, // Already base64 from export
          person.verseId,
          person.prayerCount,
          person.lastPrayedAt,
        ],
      });
      console.log(`  ✓ ${person.displayName}`);
    } catch (error) {
      console.error(`  ✗ ${person.displayName}:`, error.message);
    }
  }
  
  // Import links
  console.log('\nImporting links...');
  for (const link of exportData.links) {
    try {
      await db.execute({
        sql: `
          INSERT OR REPLACE INTO links 
          (id, person1Id, person2Id, displayName, createdAt, updatedAt, 
           person1KeyEncrypted, person2KeyEncrypted, prayerDataEncrypted, verseId, prayerCount, lastPrayedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          link.id,
          link.person1Id,
          link.person2Id,
          link.displayName,
          link.createdAt,
          link.updatedAt,
          link.person1KeyEncrypted,
          link.person2KeyEncrypted,
          link.prayerDataEncrypted, // Already base64 from export
          link.verseId,
          link.prayerCount,
          link.lastPrayedAt,
        ],
      });
      console.log(`  ✓ ${link.displayName}`);
    } catch (error) {
      console.error(`  ✗ ${link.displayName}:`, error.message);
    }
  }
  
  // Import master settings
  console.log('\nImporting master settings...');
  for (const settings of exportData.masterSettings) {
    try {
      await db.execute({
        sql: `
          INSERT OR REPLACE INTO master_settings 
          (id, masterPasscodeHash, webauthnCredentials, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [
          settings.id,
          settings.masterPasscodeHash,
          settings.webauthnCredentials,
          settings.createdAt,
          settings.updatedAt,
        ],
      });
      console.log(`  ✓ Master settings imported`);
    } catch (error) {
      console.error(`  ✗ Master settings:`, error.message);
    }
  }
  
  console.log('\n✅ Import complete!');
  console.log('\nNext steps:');
  console.log('1. Add environment variables to Vercel:');
  console.log('   vercel env add TURSO_DATABASE_URL');
  console.log('   vercel env add TURSO_AUTH_TOKEN');
  console.log('2. Deploy: git push');
}

main().catch(console.error);

