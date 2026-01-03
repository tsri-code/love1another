import { NextResponse } from 'next/server';
import { deleteSessionsForPerson } from '@/lib/db';
import { clearSessionCookie, getSessionForPerson } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/people/[id]/lock - Lock a person's prayers (end session)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if there's an active session for this person
    const session = await getSessionForPerson(id);
    
    if (session) {
      // Delete all sessions for this person
      deleteSessionsForPerson(id);
      await clearSessionCookie();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error locking person:', error);
    return NextResponse.json(
      { error: 'Failed to lock' },
      { status: 500 }
    );
  }
}

