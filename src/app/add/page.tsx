"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/lib/toast";
import { getInitials } from "@/lib/utils";
import { ImageCropper } from "@/components/ImageCropper";

interface Friend {
  id: string;
  fullName: string;
  username: string;
  avatarInitials?: string;
  avatarColor?: string;
  avatarPath?: string | null;
}

// Extended color palette
const AVATAR_COLORS = [
  // Warm tones
  "#c75c5c",
  "#e57373",
  "#ff8a65",
  "#ffb74d",
  "#ffd54f",
  "#fff176",
  "#dce775",
  "#aed581",
  // Cool tones
  "#81c784",
  "#4db6ac",
  "#4dd0e1",
  "#4fc3f7",
  "#64b5f6",
  "#7986cb",
  "#9575cd",
  "#ba68c8",
  // Earth tones
  "#f06292",
  "#a1887f",
  "#8b7355",
  "#b8860b",
  "#c9a959",
  "#7c9a6e",
  "#5a8a4a",
  "#6b8cae",
];

type EntityType = "person" | "group";

export default function AddPersonPage() {
  const [displayName, setDisplayName] = useState("");
  const [type, setType] = useState<EntityType>("person");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  // Passcode removed - direct access to profiles
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState("#6b8cae");

  // Connect to friend state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [showFriendSelector, setShowFriendSelector] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const { showToast } = useToast();

  // Fetch friends
  const fetchFriends = useCallback(async () => {
    setIsLoadingFriends(true);
    try {
      const res = await fetch("/api/friends?type=friends");

      if (res.ok) {
        const data = await res.json();
        const friendsList = (data.friends || []).map(
          (f: { user: Friend }) => f.user
        );
        setFriends(friendsList);
      }
    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      setIsLoadingFriends(false);
    }
  }, []);

  // Fetch friends on mount
  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Close color picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(e.target as Node)
      ) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = getInitials(displayName);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be less than 5MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Open the cropper instead of directly setting the image
      setImageToCrop(result);
    };
    reader.readAsDataURL(file);

    // Reset the input so the same file can be selected again
    e.target.value = "";
  };

  const handleCropComplete = (croppedImage: string) => {
    setAvatarImage(croppedImage);
    setImageToCrop(null);
  };

  const handleCropCancel = () => {
    setImageToCrop(null);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!displayName.trim()) {
      newErrors.name = "Name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          type,
          avatarInitials: initials,
          avatarColor: avatarColor,
          avatarPath: avatarImage,
        }),
      });

      if (!res.ok) {
        // Try to get error text first
        const text = await res.text();
        let errorMessage = "Failed to create";
        try {
          const data = JSON.parse(text);
          errorMessage = data.error || errorMessage;
        } catch {
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const profileData = await res.json();

      // If a friend was selected to connect, create the connection
      if (selectedFriend && profileData.person?.id) {
        try {
          await fetch(`/api/connections`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileId: profileData.person.id,
              connectedUserId: selectedFriend,
            }),
          });
        } catch (connError) {
          console.error("Error creating connection:", connError);
          // Don't fail the whole operation if connection fails
        }
      }

      showToast(`${displayName} added successfully`, "success");
      router.push("/");
    } catch (error) {
      console.error("Error creating:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to create",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page">
      <AppHeader
        showBack
        backHref="/"
        title={`${type === "person" ? "Create a new profile" : "Add Group"}`}
        subtitle="Create a new prayer list"
      />

      <main className="flex-1">
        <div
          className="container"
          style={{
            maxWidth: "480px",
            paddingTop: "var(--space-xl)",
            paddingBottom: "var(--space-3xl)",
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="card card-elevated animate-fade-in"
          >
            {/* Avatar preview */}
            <div
              className="flex flex-col items-center"
              style={{
                marginBottom: "var(--space-lg)",
                gap: "var(--space-md)",
              }}
            >
              <div className="relative">
                <div
                  className="rounded-full flex items-center justify-center font-serif font-semibold text-white transition-all duration-300 overflow-hidden"
                  style={{
                    width: "100px",
                    height: "100px",
                    fontSize: "32px",
                    backgroundColor: avatarImage ? "transparent" : avatarColor,
                    textShadow: avatarImage
                      ? "none"
                      : "0 1px 2px rgba(0,0,0,0.15)",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  {avatarImage ? (
                    <img
                      src={avatarImage}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

                {/* Upload button overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 rounded-full bg-[var(--surface-primary)] border-2 border-[var(--bg-primary)] shadow-md hover:bg-[var(--bg-secondary)] transition-colors"
                  style={{
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Upload photo"
                >
                  <svg
                    className="text-[var(--text-secondary)]"
                    style={{ width: "16px", height: "16px" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {avatarImage && (
                <button
                  type="button"
                  onClick={() => setAvatarImage(null)}
                  className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                  style={{ fontSize: "var(--text-sm)" }}
                >
                  Remove photo
                </button>
              )}
            </div>

            {/* Type toggle */}
            <div
              className="flex justify-center"
              style={{ marginBottom: "var(--space-lg)" }}
            >
              <div
                className="inline-flex bg-[var(--bg-secondary)] rounded-[var(--card-radius-sm)]"
                style={{ padding: "4px", gap: "4px" }}
              >
                <button
                  type="button"
                  onClick={() => setType("person")}
                  className={`rounded-[8px] transition-all flex items-center ${
                    type === "person"
                      ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                  style={{
                    padding: "var(--space-sm) var(--space-md)",
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    gap: "var(--space-xs)",
                  }}
                >
                  <svg
                    style={{ width: "16px", height: "16px" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Person
                </button>
                <button
                  type="button"
                  onClick={() => setType("group")}
                  className={`rounded-[8px] transition-all flex items-center ${
                    type === "group"
                      ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                  style={{
                    padding: "var(--space-sm) var(--space-md)",
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    gap: "var(--space-xs)",
                  }}
                >
                  <svg
                    style={{ width: "16px", height: "16px" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Group
                </button>
              </div>
            </div>

            <div className="divider" />

            {/* Name */}
            <div className="form-group">
              <label htmlFor="name" className="label">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                }}
                placeholder={
                  type === "person"
                    ? "e.g., Mom, John Smith"
                    : "e.g., Small Group, Family"
                }
                className={`input ${errors.name ? "input-error" : ""}`}
                maxLength={50}
              />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            {/* Color picker */}
            {!avatarImage && (
              <div className="form-group" ref={colorPickerRef}>
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: "var(--space-sm)" }}
                >
                  <label className="label" style={{ marginBottom: 0 }}>
                    Avatar Color
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="text-[var(--accent-primary)] hover:underline"
                    style={{ fontSize: "var(--text-sm)" }}
                  >
                    {showColorPicker ? "Close" : "Custom color"}
                  </button>
                </div>

                {/* Color grid */}
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: "repeat(8, 1fr)",
                    gap: "var(--space-xs)",
                  }}
                >
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAvatarColor(color)}
                      className={`rounded-full transition-transform hover:scale-110 ${
                        avatarColor === color
                          ? "ring-2 ring-offset-2 ring-[var(--text-primary)]"
                          : ""
                      }`}
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        backgroundColor: color,
                      }}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>

                {/* Custom color picker */}
                {showColorPicker && (
                  <div
                    className="bg-[var(--bg-secondary)] rounded-[var(--radius-md)]"
                    style={{
                      marginTop: "var(--space-md)",
                      padding: "var(--space-md)",
                    }}
                  >
                    <label
                      className="label"
                      style={{ marginBottom: "var(--space-sm)" }}
                    >
                      Custom Color
                    </label>
                    <div
                      className="flex items-center"
                      style={{ gap: "var(--space-md)" }}
                    >
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="rounded cursor-pointer"
                        style={{
                          width: "60px",
                          height: "40px",
                          border: "none",
                        }}
                      />
                      <input
                        type="text"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        placeholder="#000000"
                        className="input flex-1"
                        maxLength={7}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarColor(customColor);
                          setShowColorPicker(false);
                        }}
                        className="btn btn-primary btn-sm"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Connect to Friend */}
            {type === "person" && (
              <div className="form-group">
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: "var(--space-sm)" }}
                >
                  <label className="label" style={{ marginBottom: 0 }}>
                    Connect to Friend (Optional)
                  </label>
                </div>
                <p
                  className="text-[var(--text-muted)]"
                  style={{
                    fontSize: "var(--text-sm)",
                    marginBottom: "var(--space-sm)",
                  }}
                >
                  Link this profile to a friend&apos;s account so prayer
                  requests from them are automatically added.
                </p>

                {selectedFriend ? (
                  <div
                    className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-[var(--radius-md)]"
                    style={{ padding: "var(--space-md)" }}
                  >
                    <div
                      className="flex items-center"
                      style={{ gap: "var(--space-sm)" }}
                    >
                      {(() => {
                        const friend = friends.find(
                          (f) => f.id === selectedFriend
                        );
                        return friend ? (
                          <>
                            <div
                              className="rounded-full flex items-center justify-center text-white font-medium"
                              style={{
                                width: "36px",
                                height: "36px",
                                fontSize: "14px",
                                backgroundColor:
                                  friend.avatarColor || "#6b8cae",
                              }}
                            >
                              {friend.avatarInitials ||
                                getInitials(friend.fullName)}
                            </div>
                            <div>
                              <div className="font-medium text-[var(--text-primary)]">
                                {friend.fullName}
                              </div>
                              <div
                                className="text-[var(--text-muted)]"
                                style={{ fontSize: "var(--text-sm)" }}
                              >
                                @{friend.username}
                              </div>
                            </div>
                          </>
                        ) : null;
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFriend(null)}
                      className="text-[var(--error)] hover:underline"
                      style={{ fontSize: "var(--text-sm)" }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowFriendSelector(true)}
                    className="btn btn-secondary btn-full"
                    style={{
                      justifyContent: "flex-start",
                      gap: "var(--space-sm)",
                    }}
                  >
                    <svg
                      style={{ width: "20px", height: "20px" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                    Connect to a Friend
                  </button>
                )}
              </div>
            )}

            <div className="divider" />

            {/* Actions */}
            <div
              className="flex flex-col-reverse sm:flex-row"
              style={{ gap: "var(--space-sm)" }}
            >
              <button
                type="button"
                onClick={() => router.back()}
                className="btn btn-secondary btn-full sm:flex-1"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary btn-full sm:flex-1"
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin"
                      style={{ width: "20px", height: "20px" }}
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg
                      style={{ width: "20px", height: "20px" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Create {type === "person" ? "Profile" : "Group"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Friend Selector Modal */}
      {showFriendSelector && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setShowFriendSelector(false)}
        >
          <div
            className="bg-[var(--surface-primary)] rounded-[var(--card-radius)] shadow-xl w-full max-w-md mx-4"
            style={{ maxHeight: "70vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between border-b border-[var(--border-primary)]"
              style={{ padding: "var(--space-md) var(--space-lg)" }}
            >
              <h3 className="font-serif font-semibold text-[var(--text-primary)]">
                Select a Friend
              </h3>
              <button
                onClick={() => setShowFriendSelector(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <svg
                  style={{ width: "24px", height: "24px" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div
              style={{
                padding: "var(--space-md)",
                overflowY: "auto",
                maxHeight: "50vh",
              }}
            >
              {isLoadingFriends ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  Loading friends...
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  No friends yet. Add friends to connect them to profiles.
                </div>
              ) : (
                <div
                  className="flex flex-col"
                  style={{ gap: "var(--space-xs)" }}
                >
                  {friends.map((friend) => (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => {
                        setSelectedFriend(friend.id);
                        setShowFriendSelector(false);
                      }}
                      className="flex items-center w-full text-left bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-[var(--radius-md)] transition-colors"
                      style={{
                        padding: "var(--space-md)",
                        gap: "var(--space-sm)",
                      }}
                    >
                      <div
                        className="rounded-full flex items-center justify-center text-white font-medium flex-shrink-0 overflow-hidden"
                        style={{
                          width: "40px",
                          height: "40px",
                          fontSize: "14px",
                          backgroundColor: friend.avatarPath
                            ? "transparent"
                            : friend.avatarColor || "#6b8cae",
                        }}
                      >
                        {friend.avatarPath ? (
                          <img
                            src={friend.avatarPath}
                            alt={friend.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          friend.avatarInitials || getInitials(friend.fullName)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--text-primary)] truncate">
                          {friend.fullName}
                        </div>
                        <div
                          className="text-[var(--text-muted)] truncate"
                          style={{ fontSize: "var(--text-sm)" }}
                        >
                          @{friend.username}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Cropper */}
      {imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={1}
          entityType="profile"
          entityId={`new-${Date.now()}`}
        />
      )}
    </div>
  );
}
