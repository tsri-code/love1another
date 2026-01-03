import { NextResponse } from 'next/server';
import { getPersonById, updatePrayerData } from '@/lib/db';
import type { PrayerData, Prayer } from '@/lib/db';
import { decrypt, encrypt, generateId } from '@/lib/crypto';
import { getSessionForPerson, refreshSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Cache for decrypted prayer data (only valid while session active)
const decryptedDataCache = new Map<string, { data: PrayerData; passcode: string }>();

/**
 * GET /api/people/[id]/prayers - Get all prayers (requires session)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check session
    const session = await getSessionForPerson(id);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - session required' },
        { status: 401 }
      );
    }

    // Refresh session activity
    await refreshSession();

    const person = getPersonById(id);
    if (!person) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    // Get passcode from URL (passed securely via POST to unlock)
    // We need to decrypt the data using the passcode
    // The passcode should be in the session or passed in
    const url = new URL(request.url);
    const passcode = url.searchParams.get('p');

    if (!passcode) {
      return NextResponse.json(
        { error: 'Decryption key required' },
        { status: 400 }
      );
    }

    if (!person.prayerDataEncrypted) {
      return NextResponse.json({ prayers: [] });
    }

    try {
      const decryptedJson = await decrypt(person.prayerDataEncrypted, passcode);
      const prayerData: PrayerData = JSON.parse(decryptedJson);
      
      // Cache for subsequent operations
      decryptedDataCache.set(id, { data: prayerData, passcode });

      return NextResponse.json({ prayers: prayerData.prayers });
    } catch {
      return NextResponse.json(
        { error: 'Decryption failed' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error fetching prayers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prayers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people/[id]/prayers - Add a new prayer (requires session)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check session
    const session = await getSessionForPerson(id);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - session required' },
        { status: 401 }
      );
    }

    await refreshSession();

    const person = getPersonById(id);
    if (!person) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { text, passcode, category = 'immediate' } = body;

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

    // Get current prayers
    let prayerData: PrayerData = { prayers: [] };
    if (person.prayerDataEncrypted) {
      try {
        const decryptedJson = await decrypt(person.prayerDataEncrypted, passcode);
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
    const encryptedData = await encrypt(JSON.stringify(prayerData), passcode);
    const lastPrayedAt = prayerData.prayers.reduce((latest: string | null, p) => {
      if (!p.lastPrayedAt) return latest;
      if (!latest) return p.lastPrayedAt;
      return new Date(p.lastPrayedAt) > new Date(latest) ? p.lastPrayedAt : latest;
    }, null);
    
    updatePrayerData(id, encryptedData, prayerData.prayers.length, lastPrayedAt);

    return NextResponse.json({ prayer: newPrayer }, { status: 201 });
  } catch (error) {
    console.error('Error creating prayer:', error);
    return NextResponse.json(
      { error: 'Failed to create prayer' },
      { status: 500 }
    );
  }
}

