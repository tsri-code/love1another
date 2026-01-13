import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Schema for creating a group
const createGroupSchema = z.object({
  groupName: z.string().min(1).max(100),
  memberIds: z.array(z.string().uuid()).min(1),
});

// GET /api/conversations/groups - Get user's group conversations
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's group conversations
    const { data: groups, error } = await supabase.rpc(
      "get_user_group_conversations",
      { p_user_id: user.id }
    );

    if (error) {
      console.error("Error fetching groups:", error);
      return NextResponse.json(
        { error: "Failed to fetch groups" },
        { status: 500 }
      );
    }

    return NextResponse.json({ groups: groups || [] });
  } catch (error) {
    console.error("Error in GET /api/conversations/groups:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/conversations/groups - Create a new group conversation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createGroupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { groupName, memberIds } = validation.data;

    // Create the group using the helper function
    const { data: conversationId, error } = await supabase.rpc(
      "create_group_conversation",
      {
        p_group_name: groupName,
        p_member_ids: memberIds,
        p_creator_id: user.id,
      }
    );

    if (error) {
      console.error("Error creating group:", error);
      return NextResponse.json(
        { error: "Failed to create group" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      conversationId,
      message: "Group created successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/conversations/groups:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
