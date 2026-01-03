import { NextResponse } from 'next/server';
import { hasMasterPasscode, createMasterSettings, updateMasterPasscode, getMasterSettings } from '@/lib/db';
import { hashPasscode, verifyPasscode } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/passwords/setup - Check if master passcode is set up
 */
export async function GET() {
  try {
    const hasPasscode = await hasMasterPasscode();
    return NextResponse.json({ isSetUp: hasPasscode });
  } catch (error) {
    console.error('Error checking setup:', error);
    return NextResponse.json(
      { error: 'Failed to check setup' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/passwords/setup - Set up or change master passcode
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { passcode, oldPasscode } = body;
    
    if (!passcode || typeof passcode !== 'string' || passcode.length < 6) {
      return NextResponse.json(
        { error: 'Master passcode must be at least 6 characters' },
        { status: 400 }
      );
    }
    
    const settings = await getMasterSettings();
    
    if (settings) {
      // Changing existing passcode - require old passcode
      if (!oldPasscode) {
        return NextResponse.json(
          { error: 'Current passcode required to change' },
          { status: 400 }
        );
      }
      
      const valid = await verifyPasscode(oldPasscode, settings.masterPasscodeHash);
      if (!valid) {
        return NextResponse.json(
          { error: 'Invalid current passcode' },
          { status: 401 }
        );
      }
      
      const newHash = await hashPasscode(passcode);
      await updateMasterPasscode(newHash);
    } else {
      // First time setup
      const hash = await hashPasscode(passcode);
      await createMasterSettings(hash);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting up master passcode:', error);
    return NextResponse.json(
      { error: 'Failed to set up master passcode' },
      { status: 500 }
    );
  }
}
