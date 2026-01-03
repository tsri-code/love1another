import { NextResponse } from 'next/server';
import { getPersonById, createSession, isRateLimited, recordFailedAttempt, resetRateLimit, getMasterSettings } from '@/lib/db';
import { verifyPasscode, generateSessionToken, decryptStoredPasscode } from '@/lib/crypto';
import { setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/people/[id]/unlock - Unlock access to a person's prayers
 * 
 * Accepts either:
 * - { passcode: string } - the person's individual passcode
 * - { passcode: string, useMaster: true } - the master passcode (returns person's passcode for decryption)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const person = await getPersonById(id);

    if (!person) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    // Check rate limiting
    const rateLimitStatus = await isRateLimited(id);
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
    const { passcode, useMaster } = body;

    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json(
        { error: 'Passcode is required' },
        { status: 400 }
      );
    }

    let isValid = false;
    let personPasscode: string | null = null;

    if (useMaster) {
      // Try to verify against master passcode
      const masterSettings = await getMasterSettings();
      if (masterSettings) {
        isValid = await verifyPasscode(passcode, masterSettings.masterPasscodeHash);
        if (isValid && person.passcodeEncrypted) {
          // Decrypt the person's passcode so it can be used for prayer decryption
          try {
            personPasscode = decryptStoredPasscode(person.passcodeEncrypted);
          } catch {
            // If we can't decrypt, the unlock still succeeds but we won't have the passcode
            console.error('Failed to decrypt person passcode with master unlock');
          }
        }
      }
    } else {
      // Verify against person's individual passcode
      isValid = await verifyPasscode(passcode, person.passcodeHash);
      if (isValid) {
        personPasscode = passcode; // They entered the correct passcode, so we have it
      }
    }

    if (!isValid) {
      // Record failed attempt
      const attemptResult = await recordFailedAttempt(id);
      
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
    await resetRateLimit(id);
    
    const token = generateSessionToken();
    await createSession(id, token);
    await setSessionCookie(token);

    return NextResponse.json({ 
      success: true,
      personId: id,
      // Return the person's passcode if we have it (needed for prayer decryption)
      passcode: personPasscode,
    });
  } catch (error) {
    console.error('Error unlocking person:', error);
    return NextResponse.json(
      { error: 'Failed to unlock' },
      { status: 500 }
    );
  }
}
