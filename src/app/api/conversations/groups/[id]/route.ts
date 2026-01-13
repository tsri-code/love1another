import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Schema for updating a group
const updateGroupSchema = z.object({
  groupName: z.string().min(1).max(100).optional(),
  groupAvatarPath: z.string().nullable().optional(),
});

// GET /api/conversations/groups/[id] - Get group details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a member of this group
    const { data: membership } = await supabase
      .from("conversation_members")
      .select("role")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this group" },
        { status: 403 }
      );
    }

    // Get group details
    const { data: group, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("type", "group")
      .single();

    if (error || !group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Get member count
    const { count } = await supabase
      .from("conversation_members")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId);

    return NextResponse.json({
      group: {
        id: group.id,
        groupName: group.group_name,
        groupAvatarPath: group.group_avatar_path,
        creatorId: group.creator_id,
        memberCount: count || 0,
        createdAt: group.created_at,
        updatedAt: group.updated_at,
      },
      isAdmin: membership.role === "admin",
      isCreator: group.creator_id === user.id,
    });
  } catch (error) {
    console.error("Error in GET /api/conversations/groups/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/conversations/groups/[id] - Update group details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateGroupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    // Check if user is admin of this group
    const { data: membership } = await supabase
      .from("conversation_members")
      .select("role")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!membership || membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can update group details" },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (validation.data.groupName !== undefined) {
      updates.group_name = validation.data.groupName;
    }
    if (validation.data.groupAvatarPath !== undefined) {
      updates.group_avatar_path = validation.data.groupAvatarPath;
    }

    const { error } = await supabase
      .from("conversations")
      .update(updates)
      .eq("id", conversationId);

    if (error) {
      console.error("Error updating group:", error);
      return NextResponse.json(
        { error: "Failed to update group" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Group updated successfully",
    });
  } catch (error) {
    console.error("Error in PATCH /api/conversations/groups/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/conversations/groups/[id] - Delete group (creator only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is the creator
    const { data: group } = await supabase
      .from("conversations")
      .select("creator_id")
      .eq("id", conversationId)
      .eq("type", "group")
      .single();

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (group.creator_id !== user.id) {
      return NextResponse.json(
        { error: "Only the creator can delete the group" },
        { status: 403 }
      );
    }

    // Delete the conversation (cascade will remove members and messages)
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId);

    if (error) {
      console.error("Error deleting group:", error);
      return NextResponse.json(
        { error: "Failed to delete group" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Group deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/conversations/groups/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
