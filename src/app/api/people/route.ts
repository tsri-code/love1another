import { NextResponse } from 'next/server';
import { getAllPeople, createPerson } from '@/lib/db';
import { hashPasscode, encrypt, encryptPasscodeForStorage } from '@/lib/crypto';
import { getInitials } from '@/lib/utils';
import type { PrayerData, PersonType } from '@/lib/db';

// Prevent caching on sensitive routes
export const dynamic = 'force-dynamic';

/**
 * GET /api/people - List all people (persons and groups only, not links)
 */
export async function GET() {
  try {
    const people = await getAllPeople();
    return NextResponse.json({ people });
  } catch (error) {
    console.error('Error fetching people:', error);
    return NextResponse.json(
      { error: 'Failed to fetch people' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people - Create a new person or group
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { displayName, type, avatarInitials, avatarColor, avatarPath, passcode } = body;

    // Validation
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Display name is required' },
        { status: 400 }
      );
    }

    const validTypes: PersonType[] = ['person', 'group'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Type must be "person" or "group"' },
        { status: 400 }
      );
    }

    if (!passcode || typeof passcode !== 'string' || passcode.length < 4) {
      return NextResponse.json(
        { error: 'Passcode must be at least 4 characters' },
        { status: 400 }
      );
    }

    // Hash passcode
    const passcodeHash = await hashPasscode(passcode);
    
    // Encrypt passcode for admin recovery
    const passcodeEncrypted = encryptPasscodeForStorage(passcode);

    // Encrypt empty prayer data
    const initialPrayerData: PrayerData = { prayers: [] };
    const prayerDataEncrypted = await encrypt(JSON.stringify(initialPrayerData), passcode);

    // Create person/group
    const person = await createPerson({
      displayName: displayName.trim(),
      type,
      avatarInitials: avatarInitials || getInitials(displayName),
      avatarColor: avatarColor || generateRandomColor(),
      avatarPath: avatarPath || null,
      passcodeHash,
      passcodeEncrypted,
      prayerDataEncrypted,
    });

    // Return without sensitive data
    return NextResponse.json({
      person: {
        id: person.id,
        displayName: person.displayName,
        type: person.type,
        avatarPath: person.avatarPath,
        avatarInitials: person.avatarInitials,
        avatarColor: person.avatarColor,
        verseId: person.verseId,
        prayerCount: person.prayerCount,
        createdAt: person.createdAt,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json(
      { error: 'Failed to create person' },
      { status: 500 }
    );
  }
}

function generateRandomColor(): string {
  const colors = [
    '#e57373', '#f06292', '#ba68c8', '#9575cd', '#7986cb',
    '#64b5f6', '#4fc3f7', '#4dd0e1', '#4db6ac', '#81c784',
    '#aed581', '#dce775', '#fff176', '#ffd54f', '#ffb74d',
    '#ff8a65', '#a1887f', '#90a4ae',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
