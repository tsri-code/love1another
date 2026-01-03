import { NextResponse } from 'next/server';
import { getPersonById, createSession, isRateLimited, recordFailedAttempt, resetRateLimit } from '@/lib/db';
import { verifyPasscode, generateSessionToken } from '@/lib/crypto';
import { setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/people/[id]/unlock - Unlock access to a person's prayers
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const person = getPersonById(id);

    if (!person) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    // Check rate limiting
    const rateLimitStatus = isRateLimited(id);
    if (rateLimitStatus.limited) {
      const remainingSeconds = Math.ceil(
        (new Date(rateLimitStatus.lockoutEndsAt!).getTime() - Date.now()) / 1000
      );
      return NextResponse.json(
        { 
          error: 'Too many attempts. Please wait.',
          lockoutEndsAt: rateLimitStatus.lockoutEndsAt,
          remainingSeconds 
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { passcode } = body;

    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json(
        { error: 'Passcode is required' },
        { status: 400 }
      );
    }

    // Verify passcode
    const isValid = await verifyPasscode(passcode, person.passcodeHash);

    if (!isValid) {
      // Record failed attempt
      const attemptResult = recordFailedAttempt(id);
      
      if (attemptResult.locked) {
        return NextResponse.json(
          { 
            error: 'Too many attempts. Please wait.',
            lockoutEndsAt: attemptResult.lockoutEndsAt,
            remainingSeconds: 60
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { 
          error: 'Invalid passcode',
          remainingAttempts: attemptResult.remainingAttempts
        },
        { status: 401 }
      );
    }

    // Passcode correct - reset rate limit and create session
    resetRateLimit(id);
    
    const token = generateSessionToken();
    createSession(id, token);
    await setSessionCookie(token);

    return NextResponse.json({ 
      success: true,
      personId: id
    });
  } catch (error) {
    console.error('Error unlocking person:', error);
    return NextResponse.json(
      { error: 'Failed to unlock' },
      { status: 500 }
    );
  }
}

