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

    // Check if user has access using RPC (RLS blocks direct table access)
    const { data: hasAccess } = await supabase.rpc("user_has_conversation_access", {
      p_user_id: user.id,
      p_conversation_id: conversationId,
    });

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not a member of this group" },
        { status: 403 }
      );
    }

    // Get group members to determine role and count
    const { data: members } = await supabase.rpc("get_group_members", {
      p_conversation_id: conversationId,
    });

    const currentUserMember = (members || []).find(
      (m: { user_id: string }) => m.user_id === user.id
    );
    const isAdmin = currentUserMember?.role === "admin";

    // Get group details using RPC
    const { data: groupData } = await supabase.rpc("get_conversation_details", {
      p_conversation_id: conversationId,
    });

    if (!groupData || groupData.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const group = groupData[0];

    return NextResponse.json({
      group: {
        id: group.id,
        groupName: group.group_name,
        groupAvatarPath: group.group_avatar_path,
        creatorId: group.creator_id,
        memberCount: members?.length || 0,
        createdAt: group.created_at,
        updatedAt: group.updated_at,
      },
      isAdmin,
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

    // Check if user has access and get their role using RPC
    const { data: members } = await supabase.rpc("get_group_members", {
      p_conversation_id: conversationId,
    });

    const currentUserMember = (members || []).find(
      (m: { user_id: string }) => m.user_id === user.id
    );

    if (!currentUserMember) {
      return NextResponse.json(
        { error: "Not a member of this group" },
        { status: 403 }
      );
    }

    // Any member can update group name/avatar (not just admins)
    // This makes it more collaborative

    // Use RPC function to update group
    const { error } = await supabase.rpc("update_group_info", {
      p_conversation_id: conversationId,
      p_group_name: validation.data.groupName || null,
      p_group_avatar_path: validation.data.groupAvatarPath !== undefined 
        ? validation.data.groupAvatarPath 
        : null,
    });

    if (error) {
      console.error("Error updating group:", error);
      return NextResponse.json(
        { error: "Failed to update group", details: error.message },
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
