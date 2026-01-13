import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { addGroupMember, removeGroupMember } from "@/lib/supabase-db";
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
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/ecaa64e1-9858-48b0-a9e8-060dbefd294c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:149',message:'DELETE group - auth check',data:{userId:user?.id,userError:userError?{message:userError.message}:null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("userId");

    // If no userId specified, user is leaving the group
    const isSelfLeaving = !targetUserId || targetUserId === user.id;

    if (isSelfLeaving) {
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/ecaa64e1-9858-48b0-a9e8-060dbefd294c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:161',message:'DELETE group leave - entry',data:{userId:user.id,conversationId,isSelfLeaving},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // User is leaving - use delete_conversation RPC
      // The RPC handles: creator deletes whole group, member just leaves
      const { data: success, error } = await supabase.rpc("delete_conversation", {
        p_conversation_id: conversationId,
      });

      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/ecaa64e1-9858-48b0-a9e8-060dbefd294c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:166',message:'DELETE group leave - RPC result',data:{success,error:error?{code:error.code,message:error.message,details:error.details}:null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (error) {
        console.error("Error leaving group:", error);
        return NextResponse.json(
          { error: "Failed to leave group" },
          { status: 500 }
        );
      }

      if (!success) {
        // #region agent log
        fetch('http://127.0.0.1:7246/ingest/ecaa64e1-9858-48b0-a9e8-060dbefd294c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:177',message:'DELETE group leave - RPC returned false',data:{userId:user.id,conversationId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return NextResponse.json(
          { error: "Not a member of this group" },
          { status: 403 }
        );
      }

      // Check if user was the creator (group was deleted) by checking if we can still access it
      // Use user_has_conversation_access RPC instead of direct query (bypasses RLS)
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/ecaa64e1-9858-48b0-a9e8-060dbefd294c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:184',message:'DELETE group leave - checking if conversation still accessible',data:{conversationId,userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const { data: stillHasAccess } = await supabase.rpc("user_has_conversation_access", {
        p_user_id: user.id,
        p_conversation_id: conversationId,
      });
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/ecaa64e1-9858-48b0-a9e8-060dbefd294c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:188',message:'DELETE group leave - access check result',data:{stillHasAccess},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      return NextResponse.json({
        success: true,
        message: stillHasAccess ? "Left group successfully" : "Group deleted (creator left)",
        groupDeleted: !stillHasAccess,
      });
    } else {
      // Creator is kicking a member - use remove_group_member RPC
      await removeGroupMember(conversationId, targetUserId);

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
