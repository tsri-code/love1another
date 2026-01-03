import { NextResponse } from 'next/server';
import { getLinkById, updateLinkPrayerData } from '@/lib/db';
import type { PrayerData } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/crypto';
import { getSessionForEntity, refreshSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Helper to decrypt the link's encryption key using the person's passcode
 */
async function getLinkEncryptionKey(link: NonNullable<ReturnType<typeof getLinkById>>, personPasscode: string, personId: string): Promise<string | null> {
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
 * PATCH /api/links/[id]/prayers/[prayerId] - Update a prayer
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; prayerId: string }> }
) {
  try {
    const { id, prayerId } = await params;
    
    const body = await request.json();
    const { 
      text, 
      pinned, 
      answered, 
      answeredAt,
      notAnsweredNote,
      category,
      lastPrayedAt: newLastPrayedAt,
      passcode,
      personId 
    } = body;

    if (!personId || !passcode) {
      return NextResponse.json(
        { error: 'personId and passcode are required' },
        { status: 400 }
      );
    }

    // Check session for the accessing person
    const session = await getSessionForEntity(personId);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - session required' },
        { status: 401 }
      );
    }

    await refreshSession();

    const link = getLinkById(id);
    if (!link || !link.prayerDataEncrypted) {
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

    // Get the link's encryption key
    const linkKey = await getLinkEncryptionKey(link, passcode, personId);
    if (!linkKey) {
      return NextResponse.json(
        { error: 'Failed to decrypt - invalid passcode' },
        { status: 401 }
      );
    }

    // Decrypt current data
    let prayerData: PrayerData;
    try {
      const decryptedJson = await decrypt(link.prayerDataEncrypted, linkKey);
      prayerData = JSON.parse(decryptedJson);
    } catch {
      return NextResponse.json(
        { error: 'Decryption failed' },
        { status: 401 }
      );
    }

    // Find the prayer
    const prayerIndex = prayerData.prayers.findIndex(p => p.id === prayerId);
    if (prayerIndex === -1) {
      return NextResponse.json(
        { error: 'Prayer not found' },
        { status: 404 }
      );
    }

    // Get the prayer and ensure it has all required fields
    const existingPrayer = prayerData.prayers[prayerIndex];
    const prayer = {
      id: existingPrayer.id,
      text: existingPrayer.text,
      createdAt: existingPrayer.createdAt,
      updatedAt: existingPrayer.updatedAt,
      pinned: existingPrayer.pinned ?? false,
      answered: existingPrayer.answered ?? false,
      answeredAt: existingPrayer.answeredAt ?? null,
      lastPrayedAt: existingPrayer.lastPrayedAt ?? null,
      tags: existingPrayer.tags ?? [],
      category: existingPrayer.category || 'immediate',
      notAnsweredNote: existingPrayer.notAnsweredNote ?? null,
    };
    const now = new Date().toISOString();

    // Update fields
    if (text !== undefined) {
      if (typeof text !== 'string' || text.trim().length === 0) {
        return NextResponse.json(
          { error: 'Prayer text cannot be empty' },
          { status: 400 }
        );
      }
      if (text.length > 5000) {
        return NextResponse.json(
          { error: 'Prayer text too long (max 5000 characters)' },
          { status: 400 }
        );
      }
      prayer.text = text.trim();
      prayer.updatedAt = now;
    }

    if (pinned !== undefined) {
      prayer.pinned = Boolean(pinned);
      prayer.updatedAt = now;
    }

    if (answered !== undefined) {
      prayer.answered = Boolean(answered);
      prayer.updatedAt = now;
    }

    if (answeredAt !== undefined) {
      prayer.answeredAt = answeredAt;
      prayer.updatedAt = now;
    }

    if (notAnsweredNote !== undefined) {
      prayer.notAnsweredNote = notAnsweredNote;
      prayer.updatedAt = now;
    }

    if (category !== undefined) {
      if (!['immediate', 'ongoing'].includes(category)) {
        return NextResponse.json(
          { error: 'Category must be "immediate" or "ongoing"' },
          { status: 400 }
        );
      }
      prayer.category = category;
      prayer.updatedAt = now;
    }

    if (newLastPrayedAt !== undefined) {
      prayer.lastPrayedAt = newLastPrayedAt;
    }

    prayerData.prayers[prayerIndex] = prayer;

    // Re-encrypt and save
    const encryptedData = await encrypt(JSON.stringify(prayerData), linkKey);
    const lastPrayedAt = prayerData.prayers.reduce((latest: string | null, p) => {
      if (!p.lastPrayedAt) return latest;
      if (!latest) return p.lastPrayedAt;
      return new Date(p.lastPrayedAt) > new Date(latest) ? p.lastPrayedAt : latest;
    }, null);
    
    updateLinkPrayerData(id, encryptedData, prayerData.prayers.length, lastPrayedAt);

    return NextResponse.json({ prayer });
  } catch (error) {
    console.error('Error updating link prayer:', error);
    return NextResponse.json(
      { error: 'Failed to update prayer' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/links/[id]/prayers/[prayerId] - Delete a prayer
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; prayerId: string }> }
) {
  try {
    const { id, prayerId } = await params;
    
    const body = await request.json();
    const { passcode, personId } = body;

    if (!personId || !passcode) {
      return NextResponse.json(
        { error: 'personId and passcode are required' },
        { status: 400 }
      );
    }

    // Check session for the accessing person
    const session = await getSessionForEntity(personId);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - session required' },
        { status: 401 }
      );
    }

    await refreshSession();

    const link = getLinkById(id);
    if (!link || !link.prayerDataEncrypted) {
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

    // Get the link's encryption key
    const linkKey = await getLinkEncryptionKey(link, passcode, personId);
    if (!linkKey) {
      return NextResponse.json(
        { error: 'Failed to decrypt - invalid passcode' },
        { status: 401 }
      );
    }

    // Decrypt current data
    let prayerData: PrayerData;
    try {
      const decryptedJson = await decrypt(link.prayerDataEncrypted, linkKey);
      prayerData = JSON.parse(decryptedJson);
    } catch {
      return NextResponse.json(
        { error: 'Decryption failed' },
        { status: 401 }
      );
    }

    // Remove the prayer
    const initialLength = prayerData.prayers.length;
    prayerData.prayers = prayerData.prayers.filter(p => p.id !== prayerId);

    if (prayerData.prayers.length === initialLength) {
      return NextResponse.json(
        { error: 'Prayer not found' },
        { status: 404 }
      );
    }

    // Re-encrypt and save
    const encryptedData = await encrypt(JSON.stringify(prayerData), linkKey);
    const lastPrayedAt = prayerData.prayers.reduce((latest: string | null, p) => {
      if (!p.lastPrayedAt) return latest;
      if (!latest) return p.lastPrayedAt;
      return new Date(p.lastPrayedAt) > new Date(latest) ? p.lastPrayedAt : latest;
    }, null);
    
    updateLinkPrayerData(id, encryptedData, prayerData.prayers.length, lastPrayedAt);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting link prayer:', error);
    return NextResponse.json(
      { error: 'Failed to delete prayer' },
      { status: 500 }
    );
  }
}

