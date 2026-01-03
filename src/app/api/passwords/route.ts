import { NextResponse } from 'next/server';
import { getAllEntitiesWithPasscodes, getMasterSettings } from '@/lib/db';
import { verifyPasscode, decryptStoredPasscode } from '@/lib/crypto';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ADMIN_SESSION_COOKIE = 'admin_session';
const SESSION_DURATION = 5 * 60 * 1000; // 5 minutes

// Simple in-memory session store for admin sessions
const adminSessions = new Map<string, { expiresAt: number }>();

export function createAdminSession(): string {
  const token = crypto.randomUUID();
  adminSessions.set(token, { expiresAt: Date.now() + SESSION_DURATION });
  return token;
}

export function validateAdminSession(token: string): boolean {
  const session = adminSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    adminSessions.delete(token);
    return false;
  }
  // Extend session
  session.expiresAt = Date.now() + SESSION_DURATION;
  return true;
}

export function clearAdminSession(token: string): void {
  adminSessions.delete(token);
}

/**
 * GET /api/passwords - Get all passwords (requires admin session)
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    
    if (!sessionToken || !validateAdminSession(sessionToken)) {
      return NextResponse.json(
        { error: 'Unauthorized - admin session required' },
        { status: 401 }
      );
    }
    
    const entities = getAllEntitiesWithPasscodes();
    
    // Decrypt passcodes
    const decrypted = entities.map(entity => {
      let passcode = null;
      if (entity.passcodeEncrypted) {
        try {
          passcode = decryptStoredPasscode(entity.passcodeEncrypted);
        } catch {
          passcode = '[decryption failed]';
        }
      }
      return {
        id: entity.id,
        displayName: entity.displayName,
        entityType: entity.entityType,
        avatarInitials: entity.avatarInitials,
        avatarColor: entity.avatarColor,
        passcode,
        createdAt: entity.createdAt,
      };
    });
    
    return NextResponse.json({ entities: decrypted });
  } catch (error) {
    console.error('Error fetching passwords:', error);
    return NextResponse.json(
      { error: 'Failed to fetch passwords' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/passwords - Unlock admin with master passcode
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { passcode } = body;
    
    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json(
        { error: 'Passcode required' },
        { status: 400 }
      );
    }
    
    const settings = getMasterSettings();
    if (!settings) {
      return NextResponse.json(
        { error: 'Master passcode not set up' },
        { status: 400 }
      );
    }
    
    const valid = await verifyPasscode(passcode, settings.masterPasscodeHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid passcode' },
        { status: 401 }
      );
    }
    
    // Create session
    const token = createAdminSession();
    
    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_DURATION / 1000,
    });
    
    return response;
  } catch (error) {
    console.error('Error unlocking admin:', error);
    return NextResponse.json(
      { error: 'Failed to unlock' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/passwords - Lock admin session
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    
    if (sessionToken) {
      clearAdminSession(sessionToken);
    }
    
    const response = NextResponse.json({ success: true });
    response.cookies.delete(ADMIN_SESSION_COOKIE);
    
    return response;
  } catch (error) {
    console.error('Error locking admin:', error);
    return NextResponse.json(
      { error: 'Failed to lock' },
      { status: 500 }
    );
  }
}

