import { createClient, type Client } from '@libsql/client';
import { generateId } from './crypto';
import { getNextVerseId } from './verses';

// Turso database configuration
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

// Create Turso client
let db: Client;

if (tursoUrl && tursoAuthToken) {
  // Production: Use Turso
  db = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });
} else {
  // Development fallback: Use local file (for backwards compatibility)
  // This requires a local libsql file
  console.warn('TURSO_DATABASE_URL not set, using local embedded database');
  db = createClient({
    url: 'file:.prayer-data/prayers.db',
  });
}

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
  passcodeEncrypted: string | null;
  prayerDataEncrypted: Buffer | null;
  verseId: number;
  prayerCount: number;
  lastPrayedAt: string | null;
}

export interface Link {
  id: string;
  person1Id: string;
  person2Id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  person1KeyEncrypted: string | null;
  person2KeyEncrypted: string | null;
  prayerDataEncrypted: Buffer | null;
  verseId: number;
  prayerCount: number;
  lastPrayedAt: string | null;
}

export interface MasterSettings {
  id: string;
  masterPasscodeHash: string;
  webauthnCredentials: string | null;
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
  notAnsweredNote: string | null;
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

// Helper to convert base64 string to Buffer and vice versa
function base64ToBuffer(base64: string | null): Buffer | null {
  if (!base64) return null;
  return Buffer.from(base64, 'base64');
}

function bufferToBase64(buffer: Buffer | null): string | null {
  if (!buffer) return null;
  return buffer.toString('base64');
}

// Initialize database schema
let initialized = false;

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;
  
  try {
    // Check if tables exist
    const tablesResult = await db.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='people'
    `);
    
    if (tablesResult.rows.length === 0) {
      // Fresh database - create all tables
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
    }
    
    initialized = true;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Helper to ensure DB is initialized before any operation
async function ensureInit(): Promise<void> {
  if (!initialized) {
    await initializeDatabase();
  }
}

// Helper to map row to Person
function mapRowToPerson(row: Record<string, unknown>): Person {
  return {
    id: row.id as string,
    displayName: row.displayName as string,
    type: row.type as PersonType,
    avatarPath: row.avatarPath as string | null,
    avatarInitials: row.avatarInitials as string | null,
    avatarColor: row.avatarColor as string | null,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    passcodeHash: row.passcodeHash as string,
    passcodeEncrypted: row.passcodeEncrypted as string | null,
    prayerDataEncrypted: base64ToBuffer(row.prayerDataEncrypted as string | null),
    verseId: row.verseId as number,
    prayerCount: row.prayerCount as number,
    lastPrayedAt: row.lastPrayedAt as string | null,
  };
}

// Helper to map row to Link
function mapRowToLink(row: Record<string, unknown>): Link {
  return {
    id: row.id as string,
    person1Id: row.person1Id as string,
    person2Id: row.person2Id as string,
    displayName: row.displayName as string,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    person1KeyEncrypted: row.person1KeyEncrypted as string | null,
    person2KeyEncrypted: row.person2KeyEncrypted as string | null,
    prayerDataEncrypted: base64ToBuffer(row.prayerDataEncrypted as string | null),
    verseId: row.verseId as number,
    prayerCount: row.prayerCount as number,
    lastPrayedAt: row.lastPrayedAt as string | null,
  };
}

// People operations
export async function getAllPeople(): Promise<Omit<Person, 'passcodeHash' | 'prayerDataEncrypted'>[]> {
  await ensureInit();
  const result = await db.execute(`
    SELECT id, displayName, type, avatarPath, avatarInitials, avatarColor, 
           createdAt, updatedAt, verseId, prayerCount, lastPrayedAt
    FROM people
    ORDER BY displayName ASC
  `);
  return result.rows as unknown as Omit<Person, 'passcodeHash' | 'prayerDataEncrypted'>[];
}

export async function getPersonById(id: string): Promise<Person | undefined> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT * FROM people WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return undefined;
  return mapRowToPerson(result.rows[0] as unknown as Record<string, unknown>);
}

export async function getPersonPublicInfo(id: string): Promise<Omit<Person, 'passcodeHash' | 'prayerDataEncrypted'> | undefined> {
  await ensureInit();
  const result = await db.execute({
    sql: `
      SELECT id, displayName, type, avatarPath, avatarInitials, avatarColor, 
             createdAt, updatedAt, verseId, prayerCount, lastPrayedAt
      FROM people WHERE id = ?
    `,
    args: [id],
  });
  if (result.rows.length === 0) return undefined;
  return result.rows[0] as unknown as Omit<Person, 'passcodeHash' | 'prayerDataEncrypted'>;
}

export async function createPerson(data: {
  displayName: string;
  type: PersonType;
  avatarPath?: string | null;
  avatarInitials?: string | null;
  avatarColor?: string | null;
  passcodeHash: string;
  passcodeEncrypted?: string | null;
  prayerDataEncrypted: Buffer;
}): Promise<Person> {
  await ensureInit();
  const id = generateId();
  const now = new Date().toISOString();
  
  // Get verse ID
  const usedResult = await db.execute(`SELECT verseId FROM people UNION SELECT verseId FROM links`);
  const usedVerseIds = usedResult.rows.map(r => (r as unknown as { verseId: number }).verseId);
  const verseId = getNextVerseId(usedVerseIds);

  await db.execute({
    sql: `
      INSERT INTO people (id, displayName, type, avatarPath, avatarInitials, avatarColor, 
                          createdAt, updatedAt, passcodeHash, passcodeEncrypted, prayerDataEncrypted, verseId, prayerCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `,
    args: [
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
      bufferToBase64(data.prayerDataEncrypted),
      verseId,
    ],
  });

  return (await getPersonById(id))!;
}

export async function updatePerson(id: string, data: {
  displayName?: string;
  type?: PersonType;
  avatarPath?: string | null;
  avatarInitials?: string | null;
  avatarColor?: string | null;
}): Promise<void> {
  await ensureInit();
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
  await db.execute({
    sql: `UPDATE people SET ${fields.join(', ')} WHERE id = ?`,
    args: values,
  });
}

export async function updatePersonPasscode(id: string, passcodeHash: string, prayerDataEncrypted: Buffer | null): Promise<void> {
  await ensureInit();
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE people SET passcodeHash = ?, prayerDataEncrypted = ?, updatedAt = ? WHERE id = ?`,
    args: [passcodeHash, bufferToBase64(prayerDataEncrypted), now, id],
  });
}

export async function updatePrayerData(id: string, prayerDataEncrypted: Buffer, prayerCount: number, lastPrayedAt: string | null): Promise<void> {
  await ensureInit();
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE people SET prayerDataEncrypted = ?, prayerCount = ?, lastPrayedAt = ?, updatedAt = ? WHERE id = ?`,
    args: [bufferToBase64(prayerDataEncrypted), prayerCount, lastPrayedAt, now, id],
  });
}

export async function updateVerseId(id: string, verseId: number): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: `UPDATE people SET verseId = ? WHERE id = ?`,
    args: [verseId, id],
  });
}

export async function deletePerson(id: string): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: `DELETE FROM people WHERE id = ?`,
    args: [id],
  });
}

// Get basic info for people
export interface PersonBasicInfo {
  id: string;
  displayName: string;
  avatarInitials: string | null;
  avatarColor: string | null;
  avatarPath: string | null;
}

export async function getPersonBasicInfo(id: string): Promise<PersonBasicInfo | undefined> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT id, displayName, avatarInitials, avatarColor, avatarPath FROM people WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return undefined;
  return result.rows[0] as unknown as PersonBasicInfo;
}

export async function getAvailablePeopleForLinking(): Promise<PersonBasicInfo[]> {
  await ensureInit();
  const result = await db.execute(`
    SELECT id, displayName, avatarInitials, avatarColor, avatarPath
    FROM people WHERE type = 'person'
    ORDER BY displayName ASC
  `);
  return result.rows as unknown as PersonBasicInfo[];
}

// ==================== LINK OPERATIONS ====================

export interface LinkWithPeople extends Link {
  person1: PersonBasicInfo;
  person2: PersonBasicInfo;
}

export async function getLinksForPerson(personId: string): Promise<LinkWithPeople[]> {
  await ensureInit();
  const result = await db.execute({
    sql: `
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
    `,
    args: [personId, personId],
  });
  
  return result.rows.map(row => {
    const r = row as unknown as Record<string, unknown>;
    return {
      id: r.id as string,
      person1Id: r.person1Id as string,
      person2Id: r.person2Id as string,
      displayName: r.displayName as string,
      createdAt: r.createdAt as string,
      updatedAt: r.updatedAt as string,
      person1KeyEncrypted: r.person1KeyEncrypted as string | null,
      person2KeyEncrypted: r.person2KeyEncrypted as string | null,
      prayerDataEncrypted: base64ToBuffer(r.prayerDataEncrypted as string | null),
      verseId: r.verseId as number,
      prayerCount: r.prayerCount as number,
      lastPrayedAt: r.lastPrayedAt as string | null,
      person1: {
        id: r.person1Id as string,
        displayName: r.p1_displayName as string,
        avatarInitials: r.p1_avatarInitials as string | null,
        avatarColor: r.p1_avatarColor as string | null,
        avatarPath: r.p1_avatarPath as string | null,
      },
      person2: {
        id: r.person2Id as string,
        displayName: r.p2_displayName as string,
        avatarInitials: r.p2_avatarInitials as string | null,
        avatarColor: r.p2_avatarColor as string | null,
        avatarPath: r.p2_avatarPath as string | null,
      },
    };
  });
}

export async function getLinkById(id: string): Promise<Link | undefined> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT * FROM links WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return undefined;
  return mapRowToLink(result.rows[0] as unknown as Record<string, unknown>);
}

export async function getLinkPublicInfo(id: string): Promise<Omit<Link, 'person1KeyEncrypted' | 'person2KeyEncrypted' | 'prayerDataEncrypted'> | undefined> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT id, person1Id, person2Id, displayName, createdAt, updatedAt, verseId, prayerCount, lastPrayedAt FROM links WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return undefined;
  return result.rows[0] as unknown as Omit<Link, 'person1KeyEncrypted' | 'person2KeyEncrypted' | 'prayerDataEncrypted'>;
}

export async function createLink(data: {
  person1Id: string;
  person2Id: string;
  displayName: string;
  person1KeyEncrypted: string;
  person2KeyEncrypted: string;
  prayerDataEncrypted: Buffer;
}): Promise<Link> {
  await ensureInit();
  const id = generateId();
  const now = new Date().toISOString();
  
  const usedResult = await db.execute(`SELECT verseId FROM people UNION SELECT verseId FROM links`);
  const usedVerseIds = usedResult.rows.map(r => (r as unknown as { verseId: number }).verseId);
  const verseId = getNextVerseId(usedVerseIds);

  await db.execute({
    sql: `
      INSERT INTO links (id, person1Id, person2Id, displayName, createdAt, updatedAt, 
                         person1KeyEncrypted, person2KeyEncrypted, prayerDataEncrypted, verseId, prayerCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `,
    args: [
      id,
      data.person1Id,
      data.person2Id,
      data.displayName,
      now,
      now,
      data.person1KeyEncrypted,
      data.person2KeyEncrypted,
      bufferToBase64(data.prayerDataEncrypted),
      verseId,
    ],
  });

  return (await getLinkById(id))!;
}

export async function updateLink(id: string, data: { displayName?: string }): Promise<void> {
  await ensureInit();
  const now = new Date().toISOString();
  const fields: string[] = ['updatedAt = ?'];
  const values: (string | null)[] = [now];

  if (data.displayName !== undefined) {
    fields.push('displayName = ?');
    values.push(data.displayName);
  }

  values.push(id);
  await db.execute({
    sql: `UPDATE links SET ${fields.join(', ')} WHERE id = ?`,
    args: values,
  });
}

export async function updateLinkPrayerData(id: string, prayerDataEncrypted: Buffer, prayerCount: number, lastPrayedAt: string | null): Promise<void> {
  await ensureInit();
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE links SET prayerDataEncrypted = ?, prayerCount = ?, lastPrayedAt = ?, updatedAt = ? WHERE id = ?`,
    args: [bufferToBase64(prayerDataEncrypted), prayerCount, lastPrayedAt, now, id],
  });
}

export async function deleteLink(id: string): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: `DELETE FROM links WHERE id = ?`,
    args: [id],
  });
}

export async function getLinkBetweenPeople(person1Id: string, person2Id: string): Promise<Link | undefined> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT * FROM links WHERE (person1Id = ? AND person2Id = ?) OR (person1Id = ? AND person2Id = ?)`,
    args: [person1Id, person2Id, person2Id, person1Id],
  });
  if (result.rows.length === 0) return undefined;
  return mapRowToLink(result.rows[0] as unknown as Record<string, unknown>);
}

// Session operations
const SESSION_DURATION_MS = 5 * 60 * 1000;

export async function createSession(personId: string, token: string): Promise<Session> {
  await ensureInit();
  const id = generateId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  await db.execute({
    sql: `INSERT INTO sessions (id, personId, token, createdAt, lastActivityAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, personId, token, now.toISOString(), now.toISOString(), expiresAt.toISOString()],
  });

  return {
    id,
    personId,
    token,
    createdAt: now.toISOString(),
    lastActivityAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getSessionByToken(token: string): Promise<Session | undefined> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT * FROM sessions WHERE token = ?`,
    args: [token],
  });
  if (result.rows.length === 0) return undefined;
  return result.rows[0] as unknown as Session;
}

export async function getActiveSessionForPerson(personId: string): Promise<Session | undefined> {
  await ensureInit();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `SELECT * FROM sessions WHERE personId = ? AND expiresAt > ? ORDER BY expiresAt DESC LIMIT 1`,
    args: [personId, now],
  });
  if (result.rows.length === 0) return undefined;
  return result.rows[0] as unknown as Session;
}

export async function updateSessionActivity(token: string): Promise<void> {
  await ensureInit();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  await db.execute({
    sql: `UPDATE sessions SET lastActivityAt = ?, expiresAt = ? WHERE token = ?`,
    args: [now.toISOString(), expiresAt.toISOString(), token],
  });
}

export async function deleteSession(token: string): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: `DELETE FROM sessions WHERE token = ?`,
    args: [token],
  });
}

export async function deleteSessionsForPerson(personId: string): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: `DELETE FROM sessions WHERE personId = ?`,
    args: [personId],
  });
}

export async function cleanupExpiredSessions(): Promise<void> {
  await ensureInit();
  const now = new Date().toISOString();
  await db.execute({
    sql: `DELETE FROM sessions WHERE expiresAt <= ?`,
    args: [now],
  });
}

// Rate limiting operations
const MAX_ATTEMPTS = 8;
const LOCKOUT_DURATION_MS = 60 * 1000;

export async function getRateLimit(personId: string): Promise<RateLimitEntry | undefined> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT * FROM rate_limits WHERE personId = ?`,
    args: [personId],
  });
  if (result.rows.length === 0) return undefined;
  return result.rows[0] as unknown as RateLimitEntry;
}

export async function recordFailedAttempt(personId: string): Promise<{ locked: boolean; remainingAttempts: number; lockoutEndsAt?: string }> {
  await ensureInit();
  const now = new Date();
  const entry = await getRateLimit(personId);

  if (entry) {
    if (entry.lockedUntil && new Date(entry.lockedUntil) > now) {
      return { locked: true, remainingAttempts: 0, lockoutEndsAt: entry.lockedUntil };
    }

    const newAttempts = entry.lockedUntil ? 1 : entry.attempts + 1;
    const isLocked = newAttempts >= MAX_ATTEMPTS;
    const lockoutEndsAt = isLocked ? new Date(now.getTime() + LOCKOUT_DURATION_MS).toISOString() : null;

    await db.execute({
      sql: `UPDATE rate_limits SET attempts = ?, lastAttemptAt = ?, lockedUntil = ? WHERE personId = ?`,
      args: [newAttempts, now.toISOString(), lockoutEndsAt, personId],
    });

    return {
      locked: isLocked,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - newAttempts),
      lockoutEndsAt: lockoutEndsAt || undefined,
    };
  } else {
    await db.execute({
      sql: `INSERT INTO rate_limits (personId, attempts, lastAttemptAt, lockedUntil) VALUES (?, 1, ?, NULL)`,
      args: [personId, now.toISOString()],
    });
    return { locked: false, remainingAttempts: MAX_ATTEMPTS - 1 };
  }
}

export async function resetRateLimit(personId: string): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: `DELETE FROM rate_limits WHERE personId = ?`,
    args: [personId],
  });
}

export async function isRateLimited(personId: string): Promise<{ limited: boolean; lockoutEndsAt?: string }> {
  const entry = await getRateLimit(personId);
  if (!entry || !entry.lockedUntil) {
    return { limited: false };
  }

  if (new Date(entry.lockedUntil) > new Date()) {
    return { limited: true, lockoutEndsAt: entry.lockedUntil };
  }

  return { limited: false };
}

// Master settings operations
export async function getMasterSettings(): Promise<MasterSettings | undefined> {
  await ensureInit();
  const result = await db.execute(`SELECT * FROM master_settings LIMIT 1`);
  if (result.rows.length === 0) return undefined;
  return result.rows[0] as unknown as MasterSettings;
}

export async function hasMasterPasscode(): Promise<boolean> {
  return (await getMasterSettings()) !== undefined;
}

export async function createMasterSettings(masterPasscodeHash: string): Promise<MasterSettings> {
  await ensureInit();
  const id = generateId();
  const now = new Date().toISOString();
  
  await db.execute({
    sql: `INSERT INTO master_settings (id, masterPasscodeHash, webauthnCredentials, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?)`,
    args: [id, masterPasscodeHash, now, now],
  });
  
  return (await getMasterSettings())!;
}

export async function updateMasterPasscode(masterPasscodeHash: string): Promise<void> {
  const settings = await getMasterSettings();
  if (!settings) {
    await createMasterSettings(masterPasscodeHash);
    return;
  }
  
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE master_settings SET masterPasscodeHash = ?, updatedAt = ? WHERE id = ?`,
    args: [masterPasscodeHash, now, settings.id],
  });
}

export async function updateWebAuthnCredentials(credentials: string[]): Promise<void> {
  const settings = await getMasterSettings();
  if (!settings) return;
  
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE master_settings SET webauthnCredentials = ?, updatedAt = ? WHERE id = ?`,
    args: [JSON.stringify(credentials), now, settings.id],
  });
}

export async function getWebAuthnCredentials(): Promise<string[]> {
  const settings = await getMasterSettings();
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

export async function getAllEntitiesWithPasscodes(): Promise<EntityWithPasscode[]> {
  await ensureInit();
  const result = await db.execute(`
    SELECT id, displayName, type as entityType, avatarInitials, avatarColor, passcodeEncrypted, createdAt
    FROM people
  `);
  const people = result.rows as unknown as EntityWithPasscode[];
  return people.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function updatePersonPasscodeEncrypted(id: string, passcodeEncrypted: string): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: `UPDATE people SET passcodeEncrypted = ? WHERE id = ?`,
    args: [passcodeEncrypted, id],
  });
}
