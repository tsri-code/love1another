import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { getInitials } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/migrate-initials - Update all existing people's initials
 * This is a one-time migration endpoint
 */
export async function POST() {
  try {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

    let db;
    if (tursoUrl && tursoAuthToken) {
      db = createClient({ url: tursoUrl, authToken: tursoAuthToken });
    } else {
      db = createClient({ url: 'file:.prayer-data/prayers.db' });
    }

    // Get all people
    const result = await db.execute('SELECT id, displayName FROM people');
    const people = result.rows;

    let updated = 0;
    for (const person of people) {
      const displayName = person.displayName as string;
      const newInitials = getInitials(displayName);
      
      await db.execute({
        sql: 'UPDATE people SET avatarInitials = ? WHERE id = ?',
        args: [newInitials, person.id as string],
      });
      updated++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Updated ${updated} people with new initials` 
    });
  } catch (error) {
    console.error('Error migrating initials:', error);
    return NextResponse.json(
      { error: 'Failed to migrate initials', details: String(error) },
      { status: 500 }
    );
  }
}

