import { NextResponse } from 'next/server';
import { getPersonById, getPersonPublicInfo, updatePerson, updatePersonPasscode, deletePerson, getLinksForPerson } from '@/lib/db';
import { verifyPasscode, hashPasscode, reencrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/people/[id] - Get person public info with their links
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const person = await getPersonPublicInfo(id);

    if (!person) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    // Get links this person is part of (without sensitive data)
    const allLinks = await getLinksForPerson(id);
    const links = allLinks.map(link => ({
      id: link.id,
      displayName: link.displayName,
      person1: link.person1,
      person2: link.person2,
      prayerCount: link.prayerCount,
      createdAt: link.createdAt,
    }));

    return NextResponse.json({ 
      person,
      links,
    });
  } catch (error) {
    console.error('Error fetching person:', error);
    return NextResponse.json(
      { error: 'Failed to fetch person' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/people/[id] - Update person (requires current passcode)
 */
export async function PUT(
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

    const body = await request.json();
    const { 
      displayName, 
      type, 
      avatarInitials, 
      avatarColor, 
      avatarPath,
      currentPasscode, 
      newPasscode,
    } = body;

    // Require current passcode for any updates
    if (!currentPasscode) {
      return NextResponse.json(
        { error: 'Current passcode required' },
        { status: 400 }
      );
    }

    // Verify current passcode
    const isValid = await verifyPasscode(currentPasscode, person.passcodeHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Incorrect passcode' },
        { status: 401 }
      );
    }

    // Validate type
    if (type && !['person', 'group'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be "person" or "group"' },
        { status: 400 }
      );
    }

    // Check if changing passcode
    if (newPasscode) {
      if (newPasscode.length < 4) {
        return NextResponse.json(
          { error: 'New passcode must be at least 4 characters' },
          { status: 400 }
        );
      }

      // Re-encrypt prayer data with new passcode
      if (person.prayerDataEncrypted) {
        const newEncryptedData = await reencrypt(
          person.prayerDataEncrypted,
          currentPasscode,
          newPasscode
        );
        const newHash = await hashPasscode(newPasscode);
        await updatePersonPasscode(id, newHash, newEncryptedData);
      } else {
        // No prayer data yet, just update hash
        const newHash = await hashPasscode(newPasscode);
        await updatePersonPasscode(id, newHash, null);
      }
    }

    // Update all fields
    await updatePerson(id, {
      displayName: displayName?.trim(),
      type,
      avatarInitials,
      avatarColor,
      avatarPath,
    });

    const updatedPerson = await getPersonPublicInfo(id);
    
    // Get links this person is part of
    const allLinks = await getLinksForPerson(id);
    const links = allLinks.map(link => ({
      id: link.id,
      displayName: link.displayName,
      person1: link.person1,
      person2: link.person2,
      prayerCount: link.prayerCount,
      createdAt: link.createdAt,
    }));

    return NextResponse.json({ 
      person: updatedPerson,
      links,
    });
  } catch (error) {
    console.error('Error updating person:', error);
    return NextResponse.json(
      { error: 'Failed to update person' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/people/[id] - Delete person (requires passcode)
 */
export async function DELETE(
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

    const body = await request.json();
    const { passcode } = body;

    if (!passcode) {
      return NextResponse.json(
        { error: 'Passcode required to delete person' },
        { status: 400 }
      );
    }

    // Verify passcode
    const isValid = await verifyPasscode(passcode, person.passcodeHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid passcode' },
        { status: 401 }
      );
    }

    // Note: Links involving this person will be cascade deleted due to foreign key
    await deletePerson(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting person:', error);
    return NextResponse.json(
      { error: 'Failed to delete person' },
      { status: 500 }
    );
  }
}
