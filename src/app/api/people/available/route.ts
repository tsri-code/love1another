import { NextResponse } from 'next/server';
import { getAvailablePeopleForLinking } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/people/available - Get people available for creating links
 * Returns only people of type 'person' (not links or groups)
 */
export async function GET() {
  try {
    const people = await getAvailablePeopleForLinking();
    return NextResponse.json({ people });
  } catch (error) {
    console.error('Error fetching available people:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available people' },
      { status: 500 }
    );
  }
}

