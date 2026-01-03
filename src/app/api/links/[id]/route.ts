import { NextResponse } from 'next/server';
import { getLinkById, getLinkPublicInfo, updateLink, updateLinkPasscode, deleteLink, getPersonBasicInfo } from '@/lib/db';
import { verifyPasscode, hashPasscode, reencrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/links/[id] - Get link public info
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const link = getLinkPublicInfo(id);

    if (!link) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }

    // Get info about the linked people
    const person1 = getPersonBasicInfo(link.person1Id);
    const person2 = getPersonBasicInfo(link.person2Id);

    return NextResponse.json({ 
      link: {
        ...link,
        person1,
        person2,
      }
    });
  } catch (error) {
    console.error('Error fetching link:', error);
    return NextResponse.json(
      { error: 'Failed to fetch link' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/links/[id] - Update link (requires current passcode)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const link = getLinkById(id);

    if (!link) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { displayName, currentPasscode, newPasscode } = body;

    // Require current passcode for any updates
    if (!currentPasscode) {
      return NextResponse.json(
        { error: 'Current passcode required' },
        { status: 400 }
      );
    }

    // Verify current passcode
    const isValid = await verifyPasscode(currentPasscode, link.passcodeHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Incorrect passcode' },
        { status: 401 }
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
      if (link.prayerDataEncrypted) {
        const newEncryptedData = await reencrypt(
          link.prayerDataEncrypted,
          currentPasscode,
          newPasscode
        );
        const newHash = await hashPasscode(newPasscode);
        updateLinkPasscode(id, newHash, newEncryptedData);
      } else {
        // No prayer data yet, just update hash
        const newHash = await hashPasscode(newPasscode);
        updateLinkPasscode(id, newHash, null);
      }
    }

    // Update non-sensitive fields
    if (displayName) {
      updateLink(id, { displayName: displayName.trim() });
    }

    const updatedLink = getLinkPublicInfo(id);
    const person1 = getPersonBasicInfo(updatedLink!.person1Id);
    const person2 = getPersonBasicInfo(updatedLink!.person2Id);

    return NextResponse.json({ 
      link: {
        ...updatedLink,
        person1,
        person2,
      }
    });
  } catch (error) {
    console.error('Error updating link:', error);
    return NextResponse.json(
      { error: 'Failed to update link' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/links/[id] - Delete link (requires passcode)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const link = getLinkById(id);

    if (!link) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { passcode } = body;

    if (!passcode) {
      return NextResponse.json(
        { error: 'Passcode required to delete link' },
        { status: 400 }
      );
    }

    // Verify passcode
    const isValid = await verifyPasscode(passcode, link.passcodeHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid passcode' },
        { status: 401 }
      );
    }

    deleteLink(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting link:', error);
    return NextResponse.json(
      { error: 'Failed to delete link' },
      { status: 500 }
    );
  }
}

