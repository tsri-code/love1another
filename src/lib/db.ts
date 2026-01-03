import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { generateId } from './crypto';
import { getNextVerseId } from './verses';

// Get the data directory - use a folder in the project for development
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '.prayer-data');
const DB_PATH = path.join(DATA_DIR, 'prayers.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Database version for migrations
const CURRENT_VERSION = 6;

// Types
export type PersonType = 'person' | 'group';

export interface Person {
  id: string;
  displayName: string;
  type: PersonType;
  avatarPath: string | null;
  avatarInitials: string | null;
  avatarColor: string | null;
  createdAt: string;
  updatedAt: string;
  passcodeHash: string;
  passcodeEncrypted: string | null; // Encrypted passcode for admin retrieval
  prayerDataEncrypted: Buffer | null;
  verseId: number;
  prayerCount: number;
  lastPrayedAt: string | null;
}

// Link between two people - shared prayer list
export interface Link {
  id: string;
  person1Id: string;
  person2Id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  // Encryption key for this link's prayers, encrypted with person1's passcode
  person1KeyEncrypted: string | null;
  // Encryption key for this link's prayers, encrypted with person2's passcode
  person2KeyEncrypted: string | null;
  // The actual encryption key (only used transiently, not stored in plaintext)
  prayerDataEncrypted: Buffer | null;
  verseId: number;
  prayerCount: number;
  lastPrayedAt: string | null;
}

export interface MasterSettings {
  id: string;
  masterPasscodeHash: string;
  webauthnCredentials: string | null; // JSON array of WebAuthn credential IDs
  createdAt: string;
  updatedAt: string;
}

export type PrayerCategory = 'immediate' | 'ongoing';

export interface Prayer {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  answered: boolean;
  answeredAt: string | null;
  lastPrayedAt: string | null;
  tags: string[];
  category: PrayerCategory;
  notAnsweredNote: string | null; // When marked "not answered", user can add what happened
}

export interface PrayerData {
  prayers: Prayer[];
}

export interface Session {
  id: string;
  personId: string;
  token: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
}

export interface RateLimitEntry {
  personId: string;
  attempts: number;
  lastAttemptAt: string;
  lockedUntil: string | null;
}

// Initialize database schema
function initializeDatabase() {
  // Check version
  const versionResult = db.prepare(`PRAGMA user_version`).get() as { user_version: number };
  const version = versionResult.user_version;

  if (version === 0) {
    // Fresh database - create all tables
    db.exec(`
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
        prayerDataEncrypted BLOB,
        verseId INTEGER NOT NULL,
        prayerCount INTEGER DEFAULT 0,
        lastPrayedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS links (
        id TEXT PRIMARY KEY,
        person1Id TEXT NOT NULL,
        person2Id TEXT NOT NULL,
        displayName TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        person1KeyEncrypted TEXT,
        person2KeyEncrypted TEXT,
        prayerDataEncrypted BLOB,
        verseId INTEGER NOT NULL,
        prayerCount INTEGER DEFAULT 0,
        lastPrayedAt TEXT,
        FOREIGN KEY (person1Id) REFERENCES people(id) ON DELETE CASCADE,
        FOREIGN KEY (person2Id) REFERENCES people(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS master_settings (
        id TEXT PRIMARY KEY,
        masterPasscodeHash TEXT NOT NULL,
        webauthnCredentials TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        personId TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        createdAt TEXT NOT NULL,
        lastActivityAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rate_limits (
        personId TEXT PRIMARY KEY,
        attempts INTEGER DEFAULT 0,
        lastAttemptAt TEXT,
        lockedUntil TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_personId ON sessions(personId);
      CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
      CREATE INDEX IF NOT EXISTS idx_links_person1 ON links(person1Id);
      CREATE INDEX IF NOT EXISTS idx_links_person2 ON links(person2Id);
    `);

    db.pragma(`user_version = ${CURRENT_VERSION}`);
  }

  // Migration from version 3 to 4: Create links table, migrate link-type people
  if (version < 4) {
    // Create links table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS links (
        id TEXT PRIMARY KEY,
        person1Id TEXT NOT NULL,
        person2Id TEXT NOT NULL,
        displayName TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        passcodeHash TEXT NOT NULL,
        passcodeEncrypted TEXT,
        prayerDataEncrypted BLOB,
        verseId INTEGER NOT NULL,
        prayerCount INTEGER DEFAULT 0,
        lastPrayedAt TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_links_person1 ON links(person1Id);
      CREATE INDEX IF NOT EXISTS idx_links_person2 ON links(person2Id);
    `);
    
    // Migrate existing 'link' type people to the new links table
    const linkPeople = db.prepare(`SELECT * FROM people WHERE type = 'link'`).all() as Array<{
      id: string;
      displayName: string;
      passcodeHash: string;
      passcodeEncrypted: string | null;
      prayerDataEncrypted: Buffer | null;
      verseId: number;
      prayerCount: number;
      lastPrayedAt: string | null;
      linkedPersonIds: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    
    for (const lp of linkPeople) {
      if (lp.linkedPersonIds) {
        try {
          const ids = JSON.parse(lp.linkedPersonIds) as string[];
          if (ids.length === 2) {
            db.prepare(`
              INSERT INTO links (id, person1Id, person2Id, displayName, createdAt, updatedAt, 
                                 passcodeHash, passcodeEncrypted, prayerDataEncrypted, verseId, prayerCount, lastPrayedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(lp.id, ids[0], ids[1], lp.displayName, lp.createdAt, lp.updatedAt,
                   lp.passcodeHash, lp.passcodeEncrypted, lp.prayerDataEncrypted, lp.verseId, lp.prayerCount, lp.lastPrayedAt);
          }
        } catch {
          // Skip invalid links
        }
      }
      // Delete the old link-type person
      db.prepare(`DELETE FROM people WHERE id = ?`).run(lp.id);
    }
    
    db.pragma(`user_version = 4`);
  }

  // Migration from version 4 to 5: Recreate sessions table without FK constraint
  // to allow sessions for both people and links
  if (version < 5) {
    db.exec(`
      -- Create new sessions table without FK constraint
      CREATE TABLE IF NOT EXISTS sessions_new (
        id TEXT PRIMARY KEY,
        personId TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        createdAt TEXT NOT NULL,
        lastActivityAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL
      );
      
      -- Copy existing sessions
      INSERT OR IGNORE INTO sessions_new SELECT * FROM sessions;
      
      -- Drop old table
      DROP TABLE IF EXISTS sessions;
      
      -- Rename new table
      ALTER TABLE sessions_new RENAME TO sessions;
      
      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_personId ON sessions(personId);
      CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
    `);
    
    db.pragma(`user_version = 5`);
  }

  // Migration from version 5 to 6: Change link encryption to use per-person keys
  // Links no longer have their own passcode - the encryption key is stored encrypted
  // with each linked person's passcode
  if (version < 6) {
    // Add new columns for per-person encrypted keys
    try {
      db.exec(`ALTER TABLE links ADD COLUMN person1KeyEncrypted TEXT`);
    } catch { /* Column may already exist */ }
    
    try {
      db.exec(`ALTER TABLE links ADD COLUMN person2KeyEncrypted TEXT`);
    } catch { /* Column may already exist */ }
    
    // Note: Existing links will need to be re-created as we can't migrate
    // the encryption without the original passcodes. Delete existing links.
    db.exec(`DELETE FROM links`);
    
    db.pragma(`user_version = ${CURRENT_VERSION}`);
  }
}

initializeDatabase();

// People operations
export function getAllPeople(): Omit<Person, 'passcodeHash' | 'prayerDataEncrypted'>[] {
  const stmt = db.prepare(`
    SELECT id, displayName, type, avatarPath, avatarInitials, avatarColor, 
           createdAt, updatedAt, verseId, prayerCount, lastPrayedAt
    FROM people
    ORDER BY displayName ASC
  `);
  return stmt.all() as Omit<Person, 'passcodeHash' | 'prayerDataEncrypted'>[];
}

export function getPersonById(id: string): Person | undefined {
  const stmt = db.prepare(`SELECT * FROM people WHERE id = ?`);
  return stmt.get(id) as Person | undefined;
}

export function getPersonPublicInfo(id: string): Omit<Person, 'passcodeHash' | 'prayerDataEncrypted'> | undefined {
  const stmt = db.prepare(`
    SELECT id, displayName, type, avatarPath, avatarInitials, avatarColor, 
           createdAt, updatedAt, verseId, prayerCount, lastPrayedAt
    FROM people WHERE id = ?
  `);
  return stmt.get(id) as Omit<Person, 'passcodeHash' | 'prayerDataEncrypted'> | undefined;
}

export function createPerson(data: {
  displayName: string;
  type: PersonType;
  avatarPath?: string | null;
  avatarInitials?: string | null;
  avatarColor?: string | null;
  passcodeHash: string;
  passcodeEncrypted?: string | null;
  prayerDataEncrypted: Buffer;
}): Person {
  const id = generateId();
  const now = new Date().toISOString();
  
  // Get verse ID
  const usedVerseIds = db.prepare(`SELECT verseId FROM people UNION SELECT verseId FROM links`).all() as { verseId: number }[];
  const verseId = getNextVerseId(usedVerseIds.map(v => v.verseId));

  const stmt = db.prepare(`
    INSERT INTO people (id, displayName, type, avatarPath, avatarInitials, avatarColor, 
                        createdAt, updatedAt, passcodeHash, passcodeEncrypted, prayerDataEncrypted, verseId, prayerCount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  stmt.run(
    id,
    data.displayName,
    data.type,
    data.avatarPath || null,
    data.avatarInitials || null,
    data.avatarColor || null,
    now,
    now,
    data.passcodeHash,
    data.passcodeEncrypted || null,
    data.prayerDataEncrypted,
    verseId
  );

  return getPersonById(id)!;
}

export function updatePerson(id: string, data: {
  displayName?: string;
  type?: PersonType;
  avatarPath?: string | null;
  avatarInitials?: string | null;
  avatarColor?: string | null;
}): void {
  const now = new Date().toISOString();
  const fields: string[] = ['updatedAt = ?'];
  const values: (string | null)[] = [now];

  if (data.displayName !== undefined) {
    fields.push('displayName = ?');
    values.push(data.displayName);
  }
  if (data.type !== undefined) {
    fields.push('type = ?');
    values.push(data.type);
  }
  if (data.avatarPath !== undefined) {
    fields.push('avatarPath = ?');
    values.push(data.avatarPath);
  }
  if (data.avatarInitials !== undefined) {
    fields.push('avatarInitials = ?');
    values.push(data.avatarInitials);
  }
  if (data.avatarColor !== undefined) {
    fields.push('avatarColor = ?');
    values.push(data.avatarColor);
  }

  values.push(id);
  const stmt = db.prepare(`UPDATE people SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
}

export function updatePersonPasscode(id: string, passcodeHash: string, prayerDataEncrypted: Buffer | null): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE people SET passcodeHash = ?, prayerDataEncrypted = ?, updatedAt = ? WHERE id = ?
  `);
  stmt.run(passcodeHash, prayerDataEncrypted, now, id);
}

export function updatePrayerData(id: string, prayerDataEncrypted: Buffer, prayerCount: number, lastPrayedAt: string | null): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE people SET prayerDataEncrypted = ?, prayerCount = ?, lastPrayedAt = ?, updatedAt = ? WHERE id = ?
  `);
  stmt.run(prayerDataEncrypted, prayerCount, lastPrayedAt, now, id);
}

export function updateVerseId(id: string, verseId: number): void {
  const stmt = db.prepare(`UPDATE people SET verseId = ? WHERE id = ?`);
  stmt.run(verseId, id);
}

export function deletePerson(id: string): void {
  const stmt = db.prepare(`DELETE FROM people WHERE id = ?`);
  stmt.run(id);
}

// Get basic info for people (for displaying avatars, etc.)
export interface PersonBasicInfo {
  id: string;
  displayName: string;
  avatarInitials: string | null;
  avatarColor: string | null;
  avatarPath: string | null;
}

export function getPersonBasicInfo(id: string): PersonBasicInfo | undefined {
  const stmt = db.prepare(`
    SELECT id, displayName, avatarInitials, avatarColor, avatarPath
    FROM people WHERE id = ?
  `);
  return stmt.get(id) as PersonBasicInfo | undefined;
}

// Get all people who are of type 'person' (for linking selection)
export function getAvailablePeopleForLinking(): PersonBasicInfo[] {
  const stmt = db.prepare(`
    SELECT id, displayName, avatarInitials, avatarColor, avatarPath
    FROM people WHERE type = 'person'
    ORDER BY displayName ASC
  `);
  return stmt.all() as PersonBasicInfo[];
}

// ==================== LINK OPERATIONS ====================

export interface LinkWithPeople extends Link {
  person1: PersonBasicInfo;
  person2: PersonBasicInfo;
}

// Get all links for a specific person
export function getLinksForPerson(personId: string): LinkWithPeople[] {
  const stmt = db.prepare(`
    SELECT l.*, 
           p1.displayName as p1_displayName, p1.avatarInitials as p1_avatarInitials, 
           p1.avatarColor as p1_avatarColor, p1.avatarPath as p1_avatarPath,
           p2.displayName as p2_displayName, p2.avatarInitials as p2_avatarInitials,
           p2.avatarColor as p2_avatarColor, p2.avatarPath as p2_avatarPath
    FROM links l
    JOIN people p1 ON l.person1Id = p1.id
    JOIN people p2 ON l.person2Id = p2.id
    WHERE l.person1Id = ? OR l.person2Id = ?
    ORDER BY l.displayName ASC
  `);
  
  const rows = stmt.all(personId, personId) as Array<{
    id: string;
    person1Id: string;
    person2Id: string;
    displayName: string;
    createdAt: string;
    updatedAt: string;
    passcodeHash: string;
    passcodeEncrypted: string | null;
    prayerDataEncrypted: Buffer | null;
    verseId: number;
    prayerCount: number;
    lastPrayedAt: string | null;
    p1_displayName: string;
    p1_avatarInitials: string | null;
    p1_avatarColor: string | null;
    p1_avatarPath: string | null;
    p2_displayName: string;
    p2_avatarInitials: string | null;
    p2_avatarColor: string | null;
    p2_avatarPath: string | null;
  }>;
  
  return rows.map(row => ({
    id: row.id,
    person1Id: row.person1Id,
    person2Id: row.person2Id,
    displayName: row.displayName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    passcodeHash: row.passcodeHash,
    passcodeEncrypted: row.passcodeEncrypted,
    prayerDataEncrypted: row.prayerDataEncrypted,
    verseId: row.verseId,
    prayerCount: row.prayerCount,
    lastPrayedAt: row.lastPrayedAt,
    person1: {
      id: row.person1Id,
      displayName: row.p1_displayName,
      avatarInitials: row.p1_avatarInitials,
      avatarColor: row.p1_avatarColor,
      avatarPath: row.p1_avatarPath,
    },
    person2: {
      id: row.person2Id,
      displayName: row.p2_displayName,
      avatarInitials: row.p2_avatarInitials,
      avatarColor: row.p2_avatarColor,
      avatarPath: row.p2_avatarPath,
    },
  }));
}

// Get link by ID
export function getLinkById(id: string): Link | undefined {
  const stmt = db.prepare(`SELECT * FROM links WHERE id = ?`);
  return stmt.get(id) as Link | undefined;
}

// Get link public info (without sensitive data)
export function getLinkPublicInfo(id: string): Omit<Link, 'passcodeHash' | 'prayerDataEncrypted'> | undefined {
  const stmt = db.prepare(`
    SELECT id, person1Id, person2Id, displayName, createdAt, updatedAt, verseId, prayerCount, lastPrayedAt
    FROM links WHERE id = ?
  `);
  return stmt.get(id) as Omit<Link, 'passcodeHash' | 'prayerDataEncrypted'> | undefined;
}

// Create a new link between two people
export function createLink(data: {
  person1Id: string;
  person2Id: string;
  displayName: string;
  person1KeyEncrypted: string;
  person2KeyEncrypted: string;
  prayerDataEncrypted: Buffer;
}): Link {
  const id = generateId();
  const now = new Date().toISOString();
  
  // Get verse ID
  const usedVerseIds = db.prepare(`SELECT verseId FROM people UNION SELECT verseId FROM links`).all() as { verseId: number }[];
  const verseId = getNextVerseId(usedVerseIds.map(v => v.verseId));

  const stmt = db.prepare(`
    INSERT INTO links (id, person1Id, person2Id, displayName, createdAt, updatedAt, 
                       person1KeyEncrypted, person2KeyEncrypted, prayerDataEncrypted, verseId, prayerCount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  stmt.run(
    id,
    data.person1Id,
    data.person2Id,
    data.displayName,
    now,
    now,
    data.person1KeyEncrypted,
    data.person2KeyEncrypted,
    data.prayerDataEncrypted,
    verseId
  );

  return getLinkById(id)!;
}

// Update link
export function updateLink(id: string, data: {
  displayName?: string;
}): void {
  const now = new Date().toISOString();
  const fields: string[] = ['updatedAt = ?'];
  const values: (string | null)[] = [now];

  if (data.displayName !== undefined) {
    fields.push('displayName = ?');
    values.push(data.displayName);
  }

  values.push(id);
  const stmt = db.prepare(`UPDATE links SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
}

// Update link passcode
export function updateLinkPasscode(id: string, passcodeHash: string, prayerDataEncrypted: Buffer | null): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE links SET passcodeHash = ?, prayerDataEncrypted = ?, updatedAt = ? WHERE id = ?
  `);
  stmt.run(passcodeHash, prayerDataEncrypted, now, id);
}

// Update link prayer data
export function updateLinkPrayerData(id: string, prayerDataEncrypted: Buffer, prayerCount: number, lastPrayedAt: string | null): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE links SET prayerDataEncrypted = ?, prayerCount = ?, lastPrayedAt = ?, updatedAt = ? WHERE id = ?
  `);
  stmt.run(prayerDataEncrypted, prayerCount, lastPrayedAt, now, id);
}

// Delete link
export function deleteLink(id: string): void {
  const stmt = db.prepare(`DELETE FROM links WHERE id = ?`);
  stmt.run(id);
}

// Check if a link already exists between two people
export function getLinkBetweenPeople(person1Id: string, person2Id: string): Link | undefined {
  const stmt = db.prepare(`
    SELECT * FROM links 
    WHERE (person1Id = ? AND person2Id = ?) OR (person1Id = ? AND person2Id = ?)
  `);
  return stmt.get(person1Id, person2Id, person2Id, person1Id) as Link | undefined;
}

// Session operations
const SESSION_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function createSession(personId: string, token: string): Session {
  const id = generateId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  const stmt = db.prepare(`
    INSERT INTO sessions (id, personId, token, createdAt, lastActivityAt, expiresAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, personId, token, now.toISOString(), now.toISOString(), expiresAt.toISOString());

  return {
    id,
    personId,
    token,
    createdAt: now.toISOString(),
    lastActivityAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function getSessionByToken(token: string): Session | undefined {
  const stmt = db.prepare(`SELECT * FROM sessions WHERE token = ?`);
  return stmt.get(token) as Session | undefined;
}

export function getActiveSessionForPerson(personId: string): Session | undefined {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    SELECT * FROM sessions 
    WHERE personId = ? AND expiresAt > ?
    ORDER BY expiresAt DESC
    LIMIT 1
  `);
  return stmt.get(personId, now) as Session | undefined;
}

export function updateSessionActivity(token: string): void {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  const stmt = db.prepare(`
    UPDATE sessions SET lastActivityAt = ?, expiresAt = ? WHERE token = ?
  `);
  stmt.run(now.toISOString(), expiresAt.toISOString(), token);
}

export function deleteSession(token: string): void {
  const stmt = db.prepare(`DELETE FROM sessions WHERE token = ?`);
  stmt.run(token);
}

export function deleteSessionsForPerson(personId: string): void {
  const stmt = db.prepare(`DELETE FROM sessions WHERE personId = ?`);
  stmt.run(personId);
}

export function cleanupExpiredSessions(): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`DELETE FROM sessions WHERE expiresAt <= ?`);
  stmt.run(now);
}

// Rate limiting operations
const MAX_ATTEMPTS = 8;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds

export function getRateLimit(personId: string): RateLimitEntry | undefined {
  const stmt = db.prepare(`SELECT * FROM rate_limits WHERE personId = ?`);
  return stmt.get(personId) as RateLimitEntry | undefined;
}

export function recordFailedAttempt(personId: string): { locked: boolean; remainingAttempts: number; lockoutEndsAt?: string } {
  const now = new Date();
  const entry = getRateLimit(personId);

  if (entry) {
    // Check if lockout has expired
    if (entry.lockedUntil && new Date(entry.lockedUntil) > now) {
      return { locked: true, remainingAttempts: 0, lockoutEndsAt: entry.lockedUntil };
    }

    // If lockout expired, reset attempts
    const newAttempts = entry.lockedUntil ? 1 : entry.attempts + 1;
    const isLocked = newAttempts >= MAX_ATTEMPTS;
    const lockoutEndsAt = isLocked ? new Date(now.getTime() + LOCKOUT_DURATION_MS).toISOString() : null;

    const stmt = db.prepare(`
      UPDATE rate_limits SET attempts = ?, lastAttemptAt = ?, lockedUntil = ? WHERE personId = ?
    `);
    stmt.run(newAttempts, now.toISOString(), lockoutEndsAt, personId);

    return {
      locked: isLocked,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - newAttempts),
      lockoutEndsAt: lockoutEndsAt || undefined,
    };
  } else {
    // First attempt
    const stmt = db.prepare(`
      INSERT INTO rate_limits (personId, attempts, lastAttemptAt, lockedUntil)
      VALUES (?, 1, ?, NULL)
    `);
    stmt.run(personId, now.toISOString());

    return { locked: false, remainingAttempts: MAX_ATTEMPTS - 1 };
  }
}

export function resetRateLimit(personId: string): void {
  const stmt = db.prepare(`DELETE FROM rate_limits WHERE personId = ?`);
  stmt.run(personId);
}

export function isRateLimited(personId: string): { limited: boolean; lockoutEndsAt?: string } {
  const entry = getRateLimit(personId);
  if (!entry || !entry.lockedUntil) {
    return { limited: false };
  }

  if (new Date(entry.lockedUntil) > new Date()) {
    return { limited: true, lockoutEndsAt: entry.lockedUntil };
  }

  return { limited: false };
}

// Master settings operations
export function getMasterSettings(): MasterSettings | undefined {
  const stmt = db.prepare(`SELECT * FROM master_settings LIMIT 1`);
  return stmt.get() as MasterSettings | undefined;
}

export function hasMasterPasscode(): boolean {
  return getMasterSettings() !== undefined;
}

export function createMasterSettings(masterPasscodeHash: string): MasterSettings {
  const id = generateId();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO master_settings (id, masterPasscodeHash, webauthnCredentials, createdAt, updatedAt)
    VALUES (?, ?, NULL, ?, ?)
  `);
  stmt.run(id, masterPasscodeHash, now, now);
  
  return getMasterSettings()!;
}

export function updateMasterPasscode(masterPasscodeHash: string): void {
  const settings = getMasterSettings();
  if (!settings) {
    createMasterSettings(masterPasscodeHash);
    return;
  }
  
  const now = new Date().toISOString();
  const stmt = db.prepare(`UPDATE master_settings SET masterPasscodeHash = ?, updatedAt = ? WHERE id = ?`);
  stmt.run(masterPasscodeHash, now, settings.id);
}

export function updateWebAuthnCredentials(credentials: string[]): void {
  const settings = getMasterSettings();
  if (!settings) return;
  
  const now = new Date().toISOString();
  const stmt = db.prepare(`UPDATE master_settings SET webauthnCredentials = ?, updatedAt = ? WHERE id = ?`);
  stmt.run(JSON.stringify(credentials), now, settings.id);
}

export function getWebAuthnCredentials(): string[] {
  const settings = getMasterSettings();
  if (!settings || !settings.webauthnCredentials) return [];
  try {
    return JSON.parse(settings.webauthnCredentials);
  } catch {
    return [];
  }
}

// Get all passcodes for admin page
export interface EntityWithPasscode {
  id: string;
  displayName: string;
  entityType: 'person' | 'group' | 'link';
  avatarInitials: string | null;
  avatarColor: string | null;
  passcodeEncrypted: string | null;
  createdAt: string;
}

export function getAllEntitiesWithPasscodes(): EntityWithPasscode[] {
  // Get people only - links no longer have their own passcodes
  // (links use the encryption keys stored with person1/person2 passcodes)
  const peopleStmt = db.prepare(`
    SELECT id, displayName, type as entityType, avatarInitials, avatarColor, passcodeEncrypted, createdAt
    FROM people
  `);
  const people = peopleStmt.all() as EntityWithPasscode[];
  
  return people.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function updatePersonPasscodeEncrypted(id: string, passcodeEncrypted: string): void {
  const stmt = db.prepare(`UPDATE people SET passcodeEncrypted = ? WHERE id = ?`);
  stmt.run(passcodeEncrypted, id);
}

// Cleanup expired sessions periodically
setInterval(() => {
  cleanupExpiredSessions();
}, 60 * 1000); // Every minute

