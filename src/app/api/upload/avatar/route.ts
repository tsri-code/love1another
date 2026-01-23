/**
 * Avatar Upload API
 *
 * Uploads avatar images to Supabase Storage and returns the public URL.
 * This is the proper way to handle images - NOT storing base64 in metadata.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string || "profile"; // "profile", "user", or "group"
    const entityId = formData.get("entityId") as string || user.id;
    const groupId = formData.get("groupId") as string || null;

    // For group avatars, use groupId as the entity
    const finalEntityId = type === "group" && groupId ? groupId : entityId;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 2MB" }, { status: 400 });
    }

    // Generate unique filename
    const extension = file.type.split("/")[1] || "jpg";
    const filename = `${type}/${finalEntityId}/${Date.now()}.${extension}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Delete any existing avatars for this entity (cleanup old files)
    // Skip cleanup errors - folder might not exist yet
    try {
      const { data: existingFiles } = await supabase.storage
        .from("avatars")
        .list(`${type}/${finalEntityId}`);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${type}/${finalEntityId}/${f.name}`);
        await supabase.storage.from("avatars").remove(filesToDelete);
      }
    } catch (listError) {
      console.log("Note: Could not list existing files (folder may not exist yet):", listError);
    }

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", JSON.stringify(uploadError, null, 2));
      console.error("Upload error message:", uploadError.message);
      console.error("Attempted path:", filename);
      return NextResponse.json(
        { error: "Failed to upload image", details: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(data.path);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
