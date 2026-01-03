import { NextResponse } from 'next/server';
import { getPersonById, updatePrayerData } from '@/lib/db';
import type { PrayerData } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/crypto';
import { getSessionForPerson, refreshSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/people/[id]/prayers/[prayerId] - Update a prayer
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; prayerId: string }> }
) {
  try {
    const { id, prayerId } = await params;
    
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
    if (!person || !person.prayerDataEncrypted) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { 
      text, 
      pinned, 
      answered, 
      answeredAt,
      notAnsweredNote,
      category,
      lastPrayedAt: newLastPrayedAt,
      passcode 
    } = body;

    if (!passcode) {
      return NextResponse.json(
        { error: 'Passcode required for encryption' },
        { status: 400 }
      );
    }

    // Decrypt current data
    let prayerData: PrayerData;
    try {
      const decryptedJson = await decrypt(person.prayerDataEncrypted, passcode);
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

    // Get the prayer and ensure it has all required fields (for legacy prayers)
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

    // Handle answeredAt - can be set explicitly or cleared (null)
    if (answeredAt !== undefined) {
      prayer.answeredAt = answeredAt;
      prayer.updatedAt = now;
    }

    // Handle notAnsweredNote - can be set or cleared (null)
    if (notAnsweredNote !== undefined) {
      prayer.notAnsweredNote = notAnsweredNote;
      prayer.updatedAt = now;
    }

    // Handle category change
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

    // Handle lastPrayedAt update
    if (newLastPrayedAt !== undefined) {
      prayer.lastPrayedAt = newLastPrayedAt;
    }

    prayerData.prayers[prayerIndex] = prayer;

    // Re-encrypt and save
    const encryptedData = await encrypt(JSON.stringify(prayerData), passcode);
    const lastPrayedAt = prayerData.prayers.reduce((latest: string | null, p) => {
      if (!p.lastPrayedAt) return latest;
      if (!latest) return p.lastPrayedAt;
      return new Date(p.lastPrayedAt) > new Date(latest) ? p.lastPrayedAt : latest;
    }, null);
    
    updatePrayerData(id, encryptedData, prayerData.prayers.length, lastPrayedAt);

    return NextResponse.json({ prayer });
  } catch (error) {
    console.error('Error updating prayer:', error);
    return NextResponse.json(
      { error: 'Failed to update prayer' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/people/[id]/prayers/[prayerId] - Delete a prayer
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; prayerId: string }> }
) {
  try {
    const { id, prayerId } = await params;
    
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
    if (!person || !person.prayerDataEncrypted) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { passcode } = body;

    if (!passcode) {
      return NextResponse.json(
        { error: 'Passcode required for encryption' },
        { status: 400 }
      );
    }

    // Decrypt current data
    let prayerData: PrayerData;
    try {
      const decryptedJson = await decrypt(person.prayerDataEncrypted, passcode);
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
    const encryptedData = await encrypt(JSON.stringify(prayerData), passcode);
    const lastPrayedAt = prayerData.prayers.reduce((latest: string | null, p) => {
      if (!p.lastPrayedAt) return latest;
      if (!latest) return p.lastPrayedAt;
      return new Date(p.lastPrayedAt) > new Date(latest) ? p.lastPrayedAt : latest;
    }, null);
    
    updatePrayerData(id, encryptedData, prayerData.prayers.length, lastPrayedAt);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting prayer:', error);
    return NextResponse.json(
      { error: 'Failed to delete prayer' },
      { status: 500 }
    );
  }
}

