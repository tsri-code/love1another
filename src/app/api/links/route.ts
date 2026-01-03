import { NextResponse } from 'next/server';
import { createLink, getPersonById, getLinkBetweenPeople } from '@/lib/db';
import { encrypt, verifyPasscode, generateId } from '@/lib/crypto';
import type { PrayerData } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/links - Create a new link between two people
 * 
 * Requires:
 * - person1Id: The first person (who is currently logged in)
 * - person2Id: The second person to link with
 * - person1Passcode: The passcode of the logged-in person (from sessionStorage)
 * - person2Passcode: The passcode of the second person (user enters to verify access)
 * - displayName: Optional custom name for the link
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { person1Id, person2Id, displayName, person1Passcode, person2Passcode } = body;

    // Validation
    if (!person1Id || !person2Id) {
      return NextResponse.json(
        { error: 'Both person IDs are required' },
        { status: 400 }
      );
    }

    if (person1Id === person2Id) {
      return NextResponse.json(
        { error: 'Cannot link a person to themselves' },
        { status: 400 }
      );
    }

    // Verify both people exist and are of type 'person'
    const person1 = getPersonById(person1Id);
    const person2 = getPersonById(person2Id);

    if (!person1 || !person2) {
      return NextResponse.json(
        { error: 'One or both people do not exist' },
        { status: 400 }
      );
    }

    if (person1.type !== 'person' || person2.type !== 'person') {
      return NextResponse.json(
        { error: 'Links can only be created between individual people' },
        { status: 400 }
      );
    }

    // Check if link already exists
    const existingLink = getLinkBetweenPeople(person1Id, person2Id);
    if (existingLink) {
      return NextResponse.json(
        { error: 'A link already exists between these two people' },
        { status: 400 }
      );
    }

    // Verify both passcodes
    if (!person1Passcode || !person2Passcode) {
      return NextResponse.json(
        { error: 'Both passcodes are required' },
        { status: 400 }
      );
    }

    const person1Valid = await verifyPasscode(person1Passcode, person1.passcodeHash);
    if (!person1Valid) {
      return NextResponse.json(
        { error: 'Invalid passcode for first person' },
        { status: 401 }
      );
    }

    const person2Valid = await verifyPasscode(person2Passcode, person2.passcodeHash);
    if (!person2Valid) {
      return NextResponse.json(
        { error: 'Invalid passcode for second person' },
        { status: 401 }
      );
    }

    // Generate display name if not provided
    const linkDisplayName = displayName?.trim() || `${person1.displayName} & ${person2.displayName}`;

    // Generate a random encryption key for this link's prayers
    const linkEncryptionKey = generateId() + generateId(); // 72 char random key

    // Encrypt the link key with each person's passcode
    const person1KeyEncrypted = await encrypt(linkEncryptionKey, person1Passcode);
    const person2KeyEncrypted = await encrypt(linkEncryptionKey, person2Passcode);

    // Encrypt empty prayer data with the link key
    const initialPrayerData: PrayerData = { prayers: [] };
    const prayerDataEncrypted = await encrypt(JSON.stringify(initialPrayerData), linkEncryptionKey);

    // Create link
    const link = createLink({
      person1Id,
      person2Id,
      displayName: linkDisplayName,
      person1KeyEncrypted: person1KeyEncrypted.toString('base64'),
      person2KeyEncrypted: person2KeyEncrypted.toString('base64'),
      prayerDataEncrypted,
    });

    // Return without sensitive data
    return NextResponse.json({
      link: {
        id: link.id,
        person1Id: link.person1Id,
        person2Id: link.person2Id,
        displayName: link.displayName,
        verseId: link.verseId,
        prayerCount: link.prayerCount,
        createdAt: link.createdAt,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating link:', error);
    return NextResponse.json(
      { error: 'Failed to create link' },
      { status: 500 }
    );
  }
}

