import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { addGroupMember } from "@/lib/supabase-db";
import { z } from "zod";

// Schema for adding members
const addMemberSchema = z.object({
  userId: z.string().uuid(),
});

// Schema for updating member role
const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["promote", "demote"]),
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

    // Check if user has access to this conversation using RPC (not direct table query due to RLS)
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

    // Get group members with user info
    const { data: members, error } = await supabase.rpc("get_group_members", {
      p_conversation_id: conversationId,
    });

    if (error) {
      console.error("Error fetching members - full error:", JSON.stringify(error, null, 2));
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Error details:", error.details);
      console.error("Error hint:", error.hint);
      return NextResponse.json(
        { error: "Failed to fetch members", details: error.message, code: error.code },
        { status: 500 }
      );
    }

    // Determine if current user is admin by checking the members list
    const currentUserMember = (members || []).find(
      (m: { user_id: string }) => m.user_id === user.id
    );
    const isAdmin = currentUserMember?.role === "admin";

    // Check if user can leave (for admins)
    let canLeave = true;
    let leaveBlockedReason = "";

    if (isAdmin) {
      const { data: canLeaveData, error: canLeaveError } = await supabase.rpc("can_leave_group", {
        p_conversation_id: conversationId,
      });

      if (!canLeaveError && canLeaveData && canLeaveData.length > 0) {
        canLeave = canLeaveData[0].can_leave;
        leaveBlockedReason = canLeaveData[0].reason || "";
      }
    }

    // Get creator ID for the group
    const { data: conversationData } = await supabase.rpc("get_conversation_details", {
      p_conversation_id: conversationId,
    });
    const creatorId = conversationData?.[0]?.creator_id || null;

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
      isAdmin,
      canLeave,
      leaveBlockedReason,
      creatorId,
    });
  } catch (error) {
    console.error("Error in GET /api/conversations/groups/[id]/members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/conversations/groups/[id]/members - Add member to group (creator only)
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

    // Use RPC function - it handles creator check internally
    await addGroupMember(conversationId, userId);

    return NextResponse.json({
      success: true,
      message: "Member added successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/conversations/groups/[id]/members:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// PATCH /api/conversations/groups/[id]/members - Promote or demote a member
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
    const validation = updateRoleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { userId, action } = validation.data;

    if (action === "promote") {
      const { error } = await supabase.rpc("promote_to_admin", {
        p_conversation_id: conversationId,
        p_target_user_id: userId,
      });

      if (error) {
        console.error("Error promoting member:", error);
        return NextResponse.json(
          { error: error.message || "Failed to promote member" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Member promoted to admin",
      });
    } else {
      const { error } = await supabase.rpc("demote_from_admin", {
        p_conversation_id: conversationId,
        p_target_user_id: userId,
      });

      if (error) {
        console.error("Error demoting member:", error);
        return NextResponse.json(
          { error: error.message || "Failed to demote member" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Admin demoted to member",
      });
    }
  } catch (error) {
    console.error("Error in PATCH /api/conversations/groups/[id]/members:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/conversations/groups/[id]/members - Remove member or leave group
// If no userId query param: user leaves the group (uses delete_conversation RPC)
// If userId query param: creator kicks that member (uses remove_group_member RPC)
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
    const deleteGroup = url.searchParams.get("deleteGroup") === "true";

    // If deleteGroup=true, admin wants to delete entire group for everyone
    if (deleteGroup) {
      // Use RPC to delete group (handles admin check internally)
      const { data: success, error: deleteError } = await supabase.rpc("admin_delete_group", {
        p_conversation_id: conversationId,
      });

      if (deleteError) {
        console.error("Error deleting group:", deleteError);
        return NextResponse.json(
          { error: deleteError.message || "Failed to delete group" },
          { status: 400 }
        );
      }

      if (!success) {
        return NextResponse.json(
          { error: "Failed to delete group" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Group deleted successfully",
        groupDeleted: true,
      });
    }

    // If no userId specified, user is leaving the group
    const isSelfLeaving = !targetUserId || targetUserId === user.id;
    const skipLeaveCheck = url.searchParams.get("skipCheck") === "true";

    if (isSelfLeaving) {
      // First check if user can leave (admin restriction)
      if (!skipLeaveCheck) {
        const { data: canLeaveData, error: canLeaveError } = await supabase.rpc("can_leave_group", {
          p_conversation_id: conversationId,
        });

        if (canLeaveError) {
          console.error("Error checking leave permission:", canLeaveError);
        } else if (canLeaveData && canLeaveData.length > 0) {
          const { can_leave, reason } = canLeaveData[0];
          if (!can_leave) {
            return NextResponse.json(
              { error: "Cannot leave group", reason, requiresAdminAppoint: true },
              { status: 403 }
            );
          }
        }
      }

      // User is leaving - use delete_conversation RPC
      // The RPC handles: creator deletes whole group, member just leaves
      const { data: success, error } = await supabase.rpc("delete_conversation", {
        p_conversation_id: conversationId,
      });

      if (error) {
        console.error("Error leaving group:", error);
        return NextResponse.json(
          { error: "Failed to leave group" },
          { status: 500 }
        );
      }

      if (!success) {
        return NextResponse.json(
          { error: "Not a member of this group" },
          { status: 403 }
        );
      }

      // Check if user was the creator (group was deleted) by checking if we can still access it
      // Use user_has_conversation_access RPC instead of direct query (bypasses RLS)
      const { data: stillHasAccess } = await supabase.rpc("user_has_conversation_access", {
        p_user_id: user.id,
        p_conversation_id: conversationId,
      });

      return NextResponse.json({
        success: true,
        message: stillHasAccess ? "Left group successfully" : "Group deleted (creator left)",
        groupDeleted: !stillHasAccess,
      });
    } else {
      // Admin is removing a member - use admin_remove_member RPC
      const { error } = await supabase.rpc("admin_remove_member", {
        p_conversation_id: conversationId,
        p_target_user_id: targetUserId,
      });

      if (error) {
        console.error("Error removing member:", error);
        return NextResponse.json(
          { error: error.message || "Failed to remove member" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Member removed successfully",
        groupDeleted: false,
      });
    }
  } catch (error) {
    console.error("Error in DELETE /api/conversations/groups/[id]/members:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
