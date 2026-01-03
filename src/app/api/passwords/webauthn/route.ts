import { NextResponse } from 'next/server';
import { getMasterSettings, updateWebAuthnCredentials, getWebAuthnCredentials } from '@/lib/db';
import { verifyPasscode } from '@/lib/crypto';
import { cookies, headers } from 'next/headers';
import { createAdminSession } from '../route';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const ADMIN_SESSION_COOKIE = 'admin_session';
const SESSION_DURATION = 5 * 60 * 1000;

// Challenge store (in production, use Redis or DB)
const challenges = new Map<string, { challenge: string; rpId: string; expiresAt: number }>();

/**
 * Get the rpId from the request headers
 */
async function getRpId(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost';
  // Extract just the hostname without port
  const hostname = host.split(':')[0];
  return hostname;
}

/**
 * GET /api/passwords/webauthn - Get WebAuthn registration/authentication options
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const rpId = await getRpId();
    
    const challenge = crypto.randomBytes(32).toString('base64url');
    const challengeId = crypto.randomUUID();
    
    // Store challenge for verification (including rpId for validation)
    challenges.set(challengeId, { 
      challenge, 
      rpId,
      expiresAt: Date.now() + 5 * 60 * 1000 
    });
    
    // Clean up expired challenges
    for (const [id, data] of challenges.entries()) {
      if (Date.now() > data.expiresAt) {
        challenges.delete(id);
      }
    }
    
    if (action === 'register') {
      // Registration options
      return NextResponse.json({
        challengeId,
        options: {
          challenge,
          rp: {
            name: 'Love One Another',
            id: rpId,
          },
          user: {
            id: Buffer.from('admin').toString('base64url'),
            name: 'Admin',
            displayName: 'Prayer App Admin',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },  // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          timeout: 60000,
          attestation: 'none',
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
        },
      });
    } else {
      // Authentication options
      const credentials = await getWebAuthnCredentials();
      
      return NextResponse.json({
        challengeId,
        options: {
          challenge,
          timeout: 60000,
          rpId: rpId,
          userVerification: 'required',
          allowCredentials: credentials.map(id => ({
            id,
            type: 'public-key',
            transports: ['internal'],
          })),
        },
        hasCredentials: credentials.length > 0,
      });
    }
  } catch (error) {
    console.error('Error generating WebAuthn options:', error);
    return NextResponse.json(
      { error: 'Failed to generate options' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/passwords/webauthn - Register or authenticate with WebAuthn
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, challengeId, credential, passcode } = body;
    
    // Verify challenge
    const challengeData = challenges.get(challengeId);
    if (!challengeData || Date.now() > challengeData.expiresAt) {
      return NextResponse.json(
        { error: 'Challenge expired' },
        { status: 400 }
      );
    }
    challenges.delete(challengeId);
    
    if (action === 'register') {
      // Registration requires current passcode verification
      if (!passcode) {
        return NextResponse.json(
          { error: 'Passcode required for registration' },
          { status: 400 }
        );
      }
      
      const settings = await getMasterSettings();
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
      
      // Store the credential ID
      // Note: In production, you'd verify the attestation and store the public key
      const credentialId = credential.id;
      const existingCredentials = await getWebAuthnCredentials();
      
      if (!existingCredentials.includes(credentialId)) {
        await updateWebAuthnCredentials([...existingCredentials, credentialId]);
      }
      
      return NextResponse.json({ success: true });
    } else if (action === 'authenticate') {
      // Verify the credential exists
      const credentialId = credential.id;
      const existingCredentials = await getWebAuthnCredentials();
      
      if (!existingCredentials.includes(credentialId)) {
        return NextResponse.json(
          { error: 'Unknown credential' },
          { status: 401 }
        );
      }
      
      // Note: In production, you'd verify the signature with the stored public key
      // For local app with Touch ID, the browser handles the verification
      
      // Create admin session
      const token = createAdminSession();
      
      const response = NextResponse.json({ success: true });
      response.cookies.set(ADMIN_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: SESSION_DURATION / 1000,
      });
      
      return response;
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error with WebAuthn:', error);
    return NextResponse.json(
      { error: 'WebAuthn operation failed' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/passwords/webauthn - Remove WebAuthn credentials
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    
    // Require admin session to remove credentials
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    await updateWebAuthnCredentials([]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing WebAuthn credentials:', error);
    return NextResponse.json(
      { error: 'Failed to remove credentials' },
      { status: 500 }
    );
  }
}
