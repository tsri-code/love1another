"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";

interface Point {
  x: number;
  y: number;
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropperProps {
  image: string;
  onCropComplete: (imageUrl: string) => void;
  onCancel: () => void;
  aspectRatio?: number;
  entityId?: string; // Profile ID or user ID
  entityType?: "profile" | "user";
}

// Create a cropped image blob for upload
const AVATAR_SIZE = 256; // Good quality for avatars

async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageSrc;
  
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Output at fixed size for consistent quality
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;

  // Draw the cropped and resized image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE
  );

  // Return as blob (more efficient than base64)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob"));
        }
      },
      "image/jpeg",
      0.85
    );
  });
}

// Upload to Supabase Storage via API
async function uploadAvatar(
  blob: Blob,
  entityType: string,
  entityId: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, "avatar.jpg");
  formData.append("type", entityType);
  formData.append("entityId", entityId);

  const response = await fetch("/api/upload/avatar", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to upload avatar");
  }

  const data = await response.json();
  return data.url;
}

export function ImageCropper({
  image,
  onCropComplete,
  onCancel,
  aspectRatio = 1,
  entityId = "temp",
  entityType = "profile",
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropChange = useCallback((location: Point) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const onCropAreaComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    setIsSaving(true);
    setError(null);
    
    try {
      // Create cropped blob
      const blob = await getCroppedBlob(image, croppedAreaPixels);
      
      // Upload to Supabase Storage
      const imageUrl = await uploadAvatar(blob, entityType, entityId);
      
      // Return the storage URL
      onCropComplete(imageUrl);
    } catch (err) {
      console.error("Error saving avatar:", err);
      setError(err instanceof Error ? err.message : "Failed to save image");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.9)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "var(--space-md) var(--space-lg)" }}
      >
        <button
          onClick={onCancel}
          className="text-white hover:text-gray-300"
          style={{ fontSize: "var(--text-base)" }}
          disabled={isSaving}
        >
          Cancel
        </button>
        <h3 className="text-white font-medium">Adjust Photo</h3>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="text-[var(--accent-primary)] font-medium hover:opacity-80 disabled:opacity-50"
          style={{ fontSize: "var(--text-base)" }}
        >
          {isSaving ? "Uploading..." : "Done"}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-200 text-center text-sm">
          {error}
        </div>
      )}

      {/* Cropper Area */}
      <div className="flex-1 relative">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={aspectRatio}
          cropShape="round"
          showGrid={false}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropAreaComplete}
        />
      </div>

      {/* Zoom Slider */}
      <div
        className="flex items-center justify-center"
        style={{ padding: "var(--space-lg)", gap: "var(--space-md)" }}
      >
        <svg
          className="text-white"
          style={{ width: "20px", height: "20px" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
          />
        </svg>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1"
          style={{
            maxWidth: "200px",
            accentColor: "var(--accent-primary)",
          }}
        />
        <svg
          className="text-white"
          style={{ width: "20px", height: "20px" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
          />
        </svg>
      </div>
    </div>
  );
}
