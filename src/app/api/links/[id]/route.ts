import { NextResponse } from 'next/server';
import { getLinkById, getLinkPublicInfo, updateLink, deleteLink, getPersonBasicInfo, getPersonById } from '@/lib/db';
import { verifyPasscode } from '@/lib/crypto';

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
    const link = await getLinkPublicInfo(id);

    if (!link) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }

    // Get info about the linked people
    const person1 = await getPersonBasicInfo(link.person1Id);
    const person2 = await getPersonBasicInfo(link.person2Id);

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
 * PUT /api/links/[id] - Update link (requires one of the linked person's passcode)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const link = await getLinkById(id);

    if (!link) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { displayName, passcode, personId } = body;

    // Require passcode and personId for updates
    if (!passcode || !personId) {
      return NextResponse.json(
        { error: 'Passcode and personId required' },
        { status: 400 }
      );
    }

    // Verify personId is part of this link
    if (link.person1Id !== personId && link.person2Id !== personId) {
      return NextResponse.json(
        { error: 'Not authorized to update this link' },
        { status: 403 }
      );
    }

    // Get the person and verify their passcode
    const person = await getPersonById(personId);
    if (!person) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    const isValid = await verifyPasscode(passcode, person.passcodeHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Incorrect passcode' },
        { status: 401 }
      );
    }

    // Update display name if provided
    if (displayName) {
      await updateLink(id, { displayName: displayName.trim() });
    }

    const updatedLink = await getLinkPublicInfo(id);
    const person1 = await getPersonBasicInfo(updatedLink!.person1Id);
    const person2 = await getPersonBasicInfo(updatedLink!.person2Id);

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
 * DELETE /api/links/[id] - Delete link (requires one of the linked person's passcode)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const link = await getLinkById(id);

    if (!link) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { passcode, personId } = body;

    if (!passcode || !personId) {
      return NextResponse.json(
        { error: 'Passcode and personId required to delete link' },
        { status: 400 }
      );
    }

    // Verify personId is part of this link
    if (link.person1Id !== personId && link.person2Id !== personId) {
      return NextResponse.json(
        { error: 'Not authorized to delete this link' },
        { status: 403 }
      );
    }

    // Get the person and verify their passcode
    const person = await getPersonById(personId);
    if (!person) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    const isValid = await verifyPasscode(passcode, person.passcodeHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid passcode' },
        { status: 401 }
      );
    }

    await deleteLink(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting link:', error);
    return NextResponse.json(
      { error: 'Failed to delete link' },
      { status: 500 }
    );
  }
}
