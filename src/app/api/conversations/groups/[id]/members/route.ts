import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Schema for adding members
const addMemberSchema = z.object({
  userId: z.string().uuid(),
});

// GET /api/conversations/groups/[id]/members - Get group members
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
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this group" },
        { status: 403 }
      );
    }

    // Get group members with user info
    const { data: members, error } = await supabase.rpc("get_group_members", {
      p_conversation_id: conversationId,
    });

    if (error) {
      console.error("Error fetching members:", error);
      return NextResponse.json(
        { error: "Failed to fetch members" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      members: (members || []).map((m: {
        user_id: string;
        role: string;
        joined_at: string;
        email: string;
        full_name: string;
        username: string;
        avatar_initials: string | null;
        avatar_color: string;
        avatar_path: string | null;
      }) => ({
        userId: m.user_id,
        role: m.role,
        joinedAt: m.joined_at,
        email: m.email,
        fullName: m.full_name,
        username: m.username,
        avatarInitials: m.avatar_initials,
        avatarColor: m.avatar_color,
        avatarPath: m.avatar_path,
      })),
      isAdmin: membership.role === "admin",
    });
  } catch (error) {
    console.error("Error in GET /api/conversations/groups/[id]/members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/conversations/groups/[id]/members - Add member to group
export async function POST(
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
    const validation = addMemberSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { userId } = validation.data;

    // Check if current user is admin of this group
    const { data: adminCheck } = await supabase
      .from("conversation_members")
      .select("role")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!adminCheck || adminCheck.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can add members" },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from("conversation_members")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a member" },
        { status: 400 }
      );
    }

    // Add the member
    const { error } = await supabase.from("conversation_members").insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "member",
    });

    if (error) {
      console.error("Error adding member:", error);
      return NextResponse.json(
        { error: "Failed to add member" },
        { status: 500 }
      );
    }

    // Update conversation updated_at
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return NextResponse.json({
      success: true,
      message: "Member added successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/conversations/groups/[id]/members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/conversations/groups/[id]/members - Remove member or leave group
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

    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("userId");

    // If no userId specified, user is leaving the group
    const userIdToRemove = targetUserId || user.id;
    const isSelfLeaving = userIdToRemove === user.id;

    // Get current user's membership
    const { data: currentMembership } = await supabase
      .from("conversation_members")
      .select("role")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!currentMembership) {
      return NextResponse.json(
        { error: "Not a member of this group" },
        { status: 403 }
      );
    }

    // If removing someone else, must be admin
    if (!isSelfLeaving && currentMembership.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can remove members" },
        { status: 403 }
      );
    }

    // Get the conversation to check if this is the creator
    const { data: conversation } = await supabase
      .from("conversations")
      .select("creator_id")
      .eq("id", conversationId)
      .single();

    // If the creator is leaving, delete the entire group
    if (isSelfLeaving && conversation?.creator_id === user.id) {
      // Delete the conversation (cascade will remove members and messages)
      const { error: deleteError } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId);

      if (deleteError) {
        console.error("Error deleting group:", deleteError);
        return NextResponse.json(
          { error: "Failed to delete group" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Group deleted (creator left)",
        groupDeleted: true,
      });
    }

    // Remove the member
    const { error } = await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userIdToRemove);

    if (error) {
      console.error("Error removing member:", error);
      return NextResponse.json(
        { error: "Failed to remove member" },
        { status: 500 }
      );
    }

    // Update conversation updated_at
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return NextResponse.json({
      success: true,
      message: isSelfLeaving ? "Left group successfully" : "Member removed successfully",
      groupDeleted: false,
    });
  } catch (error) {
    console.error("Error in DELETE /api/conversations/groups/[id]/members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
