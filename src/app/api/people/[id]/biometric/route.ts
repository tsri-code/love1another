import { NextResponse } from 'next/server';
import { getPersonById, getWebAuthnCredentials } from '@/lib/db';
import { decryptStoredPasscode } from '@/lib/crypto';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Challenge store (in production, use Redis or DB)
const challenges = new Map<string, { challenge: string; personId: string; expiresAt: number }>();

/**
 * GET /api/people/[id]/biometric - Get WebAuthn authentication options for this person
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if person exists
    const person = await getPersonById(id);
    if (!person) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }
    
    // Check if WebAuthn credentials exist
    const credentials = await getWebAuthnCredentials();
    if (credentials.length === 0) {
      return NextResponse.json(
        { error: 'Touch ID not set up. Set it up in the Passwords page first.' },
        { status: 400 }
      );
    }
    
    const challenge = crypto.randomBytes(32).toString('base64url');
    const challengeId = crypto.randomUUID();
    
    // Store challenge for verification
    challenges.set(challengeId, { 
      challenge, 
      personId: id,
      expiresAt: Date.now() + 5 * 60 * 1000 
    });
    
    // Clean up expired challenges
    for (const [cid, data] of challenges.entries()) {
      if (Date.now() > data.expiresAt) {
        challenges.delete(cid);
      }
    }
    
    return NextResponse.json({
      challengeId,
      options: {
        challenge,
        timeout: 60000,
        rpId: 'localhost',
        userVerification: 'required',
        allowCredentials: credentials.map(credId => ({
          id: credId,
          type: 'public-key',
          transports: ['internal'],
        })),
      },
    });
  } catch (error) {
    console.error('Error generating biometric options:', error);
    return NextResponse.json(
      { error: 'Failed to generate options' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people/[id]/biometric - Authenticate with WebAuthn and get passcode
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { challengeId, credential } = body;
    
    // Verify challenge
    const challengeData = challenges.get(challengeId);
    if (!challengeData || Date.now() > challengeData.expiresAt) {
      return NextResponse.json(
        { error: 'Challenge expired' },
        { status: 400 }
      );
    }
    
    // Verify the challenge was for this person
    if (challengeData.personId !== id) {
      return NextResponse.json(
        { error: 'Challenge mismatch' },
        { status: 400 }
      );
    }
    
    challenges.delete(challengeId);
    
    // Verify the credential exists
    const credentialId = credential.id;
    const existingCredentials = await getWebAuthnCredentials();
    
    if (!existingCredentials.includes(credentialId)) {
      return NextResponse.json(
        { error: 'Unknown credential' },
        { status: 401 }
      );
    }
    
    // Get the person and decrypt their passcode
    const person = await getPersonById(id);
    if (!person) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }
    
    if (!person.passcodeEncrypted) {
      return NextResponse.json(
        { error: 'Passcode not stored for this person' },
        { status: 400 }
      );
    }
    
    let passcode: string;
    try {
      passcode = decryptStoredPasscode(person.passcodeEncrypted);
    } catch {
      return NextResponse.json(
        { error: 'Failed to decrypt passcode' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      passcode 
    });
  } catch (error) {
    console.error('Error with biometric auth:', error);
    return NextResponse.json(
      { error: 'Biometric authentication failed' },
      { status: 500 }
    );
  }
}
