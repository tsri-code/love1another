import { cookies } from 'next/headers';
import { getSessionByToken, updateSessionActivity, deleteSession as dbDeleteSession } from './db';

const SESSION_COOKIE_NAME = 'prayer_session';

export interface SessionData {
  entityId: string; // Can be person ID or link ID
  token: string;
}

/**
 * Get the current session from cookies
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!sessionCookie) {
    return null;
  }

  const token = sessionCookie.value;
  const session = await getSessionByToken(token);

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (new Date(session.expiresAt) <= new Date()) {
    await dbDeleteSession(token);
    return null;
  }

  return {
    entityId: session.personId, // personId field in DB, but can be any entity
    token: session.token,
  };
}

/**
 * Get session for a specific entity (person or link)
 */
export async function getSessionForEntity(entityId: string): Promise<SessionData | null> {
  const session = await getSession();
  if (session && session.entityId === entityId) {
    return session;
  }
  return null;
}

/**
 * Get session for a specific person (alias for backward compatibility)
 */
export async function getSessionForPerson(personId: string): Promise<SessionData | null> {
  return getSessionForEntity(personId);
}

/**
 * Refresh session activity (extend expiry)
 */
export async function refreshSession(): Promise<boolean> {
  const session = await getSession();
  if (!session) {
    return false;
  }

  await updateSessionActivity(session.token);
  return true;
}

/**
 * Delete the current session
 */
export async function deleteSession(): Promise<void> {
  const session = await getSession();
  if (session) {
    await dbDeleteSession(session.token);
  }
}

/**
 * Set session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 5 * 60, // 5 minutes
  });
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
