import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  getConnectionsForProfile,
  createConnection,
  getUserById,
  getProfileByConnectedUser,
  updateProfile,
} from "@/lib/supabase-db";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * GET /api/connections - Get connections for a profile or find profile by connected user
 * Query params:
 * - profileId: profile to get connections for
 * - connectedUserId: find profile that has this user connected (for auto-add prayer feature)
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.read);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const connectedUserId = searchParams.get("connectedUserId");

    // If looking for profile by connected user ID
    if (connectedUserId) {
      const result = await getProfileByConnectedUser(connectedUserId);
      if (result) {
        return NextResponse.json({
          found: true,
          profileId: result.profileId,
          profileName: result.profileName,
        });
      }
      return NextResponse.json({ found: false });
    }

    if (!profileId) {
      return NextResponse.json(
        { error: "Profile ID or connected user ID is required" },
        { status: 400 }
      );
    }

    const connections = await getConnectionsForProfile(profileId);

    // Fetch user details for each connection
    const connectionsWithUsers = await Promise.all(
      connections.map(async (c) => {
        const connectedUser = await getUserById(c.connected_user_id);
        return {
          id: c.id,
          profileId: c.profile_id,
          connectedUserId: c.connected_user_id,
          createdAt: c.created_at,
          connectedUser: connectedUser
            ? {
                id: connectedUser.id,
                fullName: connectedUser.full_name,
                username: connectedUser.username,
                avatarInitials: connectedUser.avatar_initials,
                avatarColor: connectedUser.avatar_color,
                avatarPath: connectedUser.avatar_path,
              }
            : null,
        };
      })
    );

    return NextResponse.json({
      connections: connectionsWithUsers,
    });
  } catch (error) {
    console.error("Error fetching connections:", error);
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/connections - Create a connection (share a profile with another user)
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.write);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { profileId, connectedUserId } = body;

    if (!profileId || !connectedUserId) {
      return NextResponse.json(
        { error: "Profile ID and connected user ID are required" },
        { status: 400 }
      );
    }

    const connection = await createConnection({
      owner_user_id: user.id,
      profile_id: profileId,
      connected_user_id: connectedUserId,
    });

    // Fetch the connected user details
    const connectedUser = await getUserById(connectedUserId);

    // Sync profile with connected user's data (name, avatar, etc.)
    if (connectedUser) {
      try {
        await updateProfile(profileId, {
          display_name: connectedUser.full_name,
          avatar_initials: connectedUser.avatar_initials || undefined,
          avatar_color: connectedUser.avatar_color || undefined,
          avatar_path: connectedUser.avatar_path || undefined,
        });
      } catch (syncError) {
        console.error("Error syncing profile with user data:", syncError);
        // Don't fail the connection if sync fails
      }
    }

    return NextResponse.json(
      {
        connection: {
          id: connection.id,
          profileId: connection.profile_id,
          connectedUserId: connection.connected_user_id,
          createdAt: connection.created_at,
          connectedUser: connectedUser
            ? {
                id: connectedUser.id,
                fullName: connectedUser.full_name,
                username: connectedUser.username,
                avatarInitials: connectedUser.avatar_initials,
                avatarColor: connectedUser.avatar_color,
                avatarPath: connectedUser.avatar_path,
              }
            : null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating connection:", error);
    return NextResponse.json(
      { error: "Failed to create connection" },
      { status: 500 }
    );
  }
}
