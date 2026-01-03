import { NextResponse } from 'next/server';
import { getSession, refreshSession, deleteSession, clearSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/session - Check current session status
 */
export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      personId: session.personId,
    });
  } catch (error) {
    console.error('Error checking session:', error);
    return NextResponse.json(
      { error: 'Failed to check session' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/session - Refresh session activity
 */
export async function POST() {
  try {
    const refreshed = await refreshSession();
    
    if (!refreshed) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error refreshing session:', error);
    return NextResponse.json(
      { error: 'Failed to refresh session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/session - End session (logout)
 */
export async function DELETE() {
  try {
    await deleteSession();
    await clearSessionCookie();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}

