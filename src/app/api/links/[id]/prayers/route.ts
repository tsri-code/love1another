import { NextResponse } from 'next/server';
import { getLinkById, updateLinkPrayerData, Link } from '@/lib/db';
import type { PrayerData, Prayer } from '@/lib/db';
import { decrypt, encrypt, generateId } from '@/lib/crypto';
import { getSessionForEntity, refreshSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Helper to decrypt the link's encryption key using the person's passcode
 */
async function getLinkEncryptionKey(link: Link, personPasscode: string, personId: string): Promise<string | null> {
  try {
    // Determine which encrypted key to use based on which person is accessing
    const encryptedKey = link.person1Id === personId 
      ? link.person1KeyEncrypted 
      : link.person2KeyEncrypted;
    
    if (!encryptedKey) {
      return null;
    }

    // Decrypt the link's encryption key using the person's passcode
    const keyBuffer = Buffer.from(encryptedKey, 'base64');
    const linkKey = await decrypt(keyBuffer, personPasscode);
    return linkKey;
  } catch {
    return null;
  }
}

/**
 * GET /api/links/[id]/prayers - Get all prayers (requires session)
 * Query params:
 * - p: The person's passcode (from sessionStorage)
 * - personId: The ID of the person accessing the link
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check session (person must be logged in)
    const session = await getSessionForEntity(id);
    // Also allow if the person accessing has their own session
    const url = new URL(request.url);
    const personId = url.searchParams.get('personId');
    const passcode = url.searchParams.get('p');
    
    // Verify session exists for either the link or the accessing person
    let validSession = !!session;
    if (!validSession && personId) {
      const personSession = await getSessionForEntity(personId);
      validSession = !!personSession;
    }
    
    if (!validSession) {
      return NextResponse.json(
        { error: 'Unauthorized - session required' },
        { status: 401 }
      );
    }

    // Refresh session activity
    await refreshSession();

    const link = await getLinkById(id);
    if (!link) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }

    if (!passcode || !personId) {
      return NextResponse.json(
        { error: 'Passcode and personId required' },
        { status: 400 }
      );
    }

    // Verify the personId is part of this link
    if (link.person1Id !== personId && link.person2Id !== personId) {
      return NextResponse.json(
        { error: 'Not authorized to access this link' },
        { status: 403 }
      );
    }

    if (!link.prayerDataEncrypted) {
      return NextResponse.json({ prayers: [] });
    }

    // Get the link's encryption key using the person's passcode
    const linkKey = await getLinkEncryptionKey(link, passcode, personId);
    if (!linkKey) {
      return NextResponse.json(
        { error: 'Failed to decrypt - invalid passcode' },
        { status: 401 }
      );
    }

    try {
      const decryptedJson = await decrypt(link.prayerDataEncrypted, linkKey);
      const prayerData: PrayerData = JSON.parse(decryptedJson);
      return NextResponse.json({ prayers: prayerData.prayers });
    } catch {
      return NextResponse.json(
        { error: 'Decryption failed' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error fetching link prayers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prayers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/links/[id]/prayers - Add a new prayer (requires session)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const body = await request.json();
    const { text, passcode, personId, category = 'immediate' } = body;

    // Check session for the accessing person
    if (!personId) {
      return NextResponse.json(
        { error: 'personId is required' },
        { status: 400 }
      );
    }

    const session = await getSessionForEntity(personId);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - session required' },
        { status: 401 }
      );
    }

    await refreshSession();

    const link = await getLinkById(id);
    if (!link) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }

    // Verify the personId is part of this link
    if (link.person1Id !== personId && link.person2Id !== personId) {
      return NextResponse.json(
        { error: 'Not authorized to access this link' },
        { status: 403 }
      );
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prayer text is required' },
        { status: 400 }
      );
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Prayer text too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    if (!passcode) {
      return NextResponse.json(
        { error: 'Passcode required for encryption' },
        { status: 400 }
      );
    }

    // Validate category
    if (!['immediate', 'ongoing'].includes(category)) {
      return NextResponse.json(
        { error: 'Category must be "immediate" or "ongoing"' },
        { status: 400 }
      );
    }

    // Get the link's encryption key
    const linkKey = await getLinkEncryptionKey(link, passcode, personId);
    if (!linkKey) {
      return NextResponse.json(
        { error: 'Failed to decrypt - invalid passcode' },
        { status: 401 }
      );
    }

    // Get current prayers
    let prayerData: PrayerData = { prayers: [] };
    if (link.prayerDataEncrypted) {
      try {
        const decryptedJson = await decrypt(link.prayerDataEncrypted, linkKey);
        prayerData = JSON.parse(decryptedJson);
      } catch {
        return NextResponse.json(
          { error: 'Decryption failed' },
          { status: 401 }
        );
      }
    }

    // Create new prayer
    const now = new Date().toISOString();
    const newPrayer: Prayer = {
      id: generateId(),
      text: text.trim(),
      createdAt: now,
      updatedAt: now,
      pinned: false,
      answered: false,
      answeredAt: null,
      lastPrayedAt: null,
      tags: [],
      category,
      notAnsweredNote: null,
    };

    prayerData.prayers.unshift(newPrayer);

    // Re-encrypt and save
    const encryptedData = await encrypt(JSON.stringify(prayerData), linkKey);
    const lastPrayedAt = prayerData.prayers.reduce((latest: string | null, p) => {
      if (!p.lastPrayedAt) return latest;
      if (!latest) return p.lastPrayedAt;
      return new Date(p.lastPrayedAt) > new Date(latest) ? p.lastPrayedAt : latest;
    }, null);
    
    await updateLinkPrayerData(id, encryptedData, prayerData.prayers.length, lastPrayedAt);

    return NextResponse.json({ prayer: newPrayer }, { status: 201 });
  } catch (error) {
    console.error('Error creating link prayer:', error);
    return NextResponse.json(
      { error: 'Failed to create prayer' },
      { status: 500 }
    );
  }
}
