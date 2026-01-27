"use client";

import { useState, useEffect, useRef, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Navbar } from "@/components/Navbar";
import { AvatarCircle } from "@/components/AvatarCircle";
import { useAuth } from "@/components/AuthGuard";
import { useToast } from "@/lib/toast";
import { getInitials } from "@/lib/utils";
import { ImageCropper } from "@/components/ImageCropper";

// Extended color palette
const AVATAR_COLORS = [
  "#c75c5c",
  "#e57373",
  "#ff8a65",
  "#ffb74d",
  "#ffd54f",
  "#fff176",
  "#dce775",
  "#aed581",
  "#81c784",
  "#4db6ac",
  "#4dd0e1",
  "#4fc3f7",
  "#64b5f6",
  "#7986cb",
  "#9575cd",
  "#ba68c8",
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

interface Person {
  id: string;
  displayName: string;
  type: EntityType;
  avatarPath: string | null;
  avatarInitials: string | null;
  avatarColor: string | null;
}

interface LinkInfo {
  id: string;
  displayName: string;
  person1: {
    id: string;
    displayName: string;
    avatarInitials: string | null;
    avatarColor: string | null;
    avatarPath?: string | null;
  };
  person2: {
    id: string;
    displayName: string;
    avatarInitials: string | null;
    avatarColor: string | null;
    avatarPath?: string | null;
  };
  prayerCount: number;
}

interface AvailablePerson {
  id: string;
  displayName: string;
  avatarInitials: string | null;
  avatarColor: string | null;
  avatarPath: string | null;
}

interface FriendUser {
  id: string;
  fullName: string;
  username: string;
  avatarInitials: string | null;
  avatarColor: string | null;
  avatarPath?: string | null;
}

interface Friend {
  id: string;
  friendshipId: string;
  status: string;
  createdAt: string;
  user: FriendUser | null;
}

interface ConnectionInfo {
  id: string;
  connectedUser: FriendUser | null;
}

export default function EditPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [person, setPerson] = useState<Person | null>(null);
  const [links, setLinks] = useState<LinkInfo[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [type, setType] = useState<EntityType>("person");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState("#6b8cae");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // For creating new links
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [availablePeople, setAvailablePeople] = useState<AvailablePerson[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  // For Connect feature
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [friendSearch, setFriendSearch] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  // For Delete feature
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // For Link Delete feature
  const [linkToDelete, setLinkToDelete] = useState<LinkInfo | null>(null);
  const [isDeletingLink, setIsDeletingLink] = useState(false);

  // Help modals
  const [showLinkHelp, setShowLinkHelp] = useState(false);
  const [showConnectHelp, setShowConnectHelp] = useState(false);

  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const currentUserId = user?.id;

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

  // Load person data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/people/${id}`);
        if (!res.ok) throw new Error("Failed to load person");
        const data = await res.json();

        setPerson(data.person);
        setDisplayName(data.person.displayName);
        setType(data.person.type);
        setAvatarColor(data.person.avatarColor || AVATAR_COLORS[0]);
        setAvatarImage(data.person.avatarPath);

        // Set links
        if (data.links) {
          setLinks(data.links);
        }

        // Fetch connection for this profile
        const connRes = await fetch(`/api/connections?profileId=${id}`);
        if (connRes.ok) {
          const connData = await connRes.json();
          if (connData.connections && connData.connections.length > 0) {
            setConnection(connData.connections[0]);
          }
        }
      } catch (error) {
        console.error("Error loading person:", error);
        showToast("Failed to load person", "error");
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, router, showToast]);

  // Load friends when connect modal opens
  useEffect(() => {
    if (showConnectModal) {
      setIsLoadingFriends(true);
      // Get current user ID from session (mock for now)
      if (currentUserId) {
        fetch(`/api/friends?type=friends`)
          .then((res) => res.json())
          .then((data) => {
            setFriends(data.friends || []);
          })
          .catch(() => {
            showToast("Failed to load friends", "error");
          })
          .finally(() => {
            setIsLoadingFriends(false);
          });
      } else {
        setIsLoadingFriends(false);
      }
    }
  }, [showConnectModal, showToast]);

  // Load available people for linking when modal opens
  useEffect(() => {
    if (showCreateLink) {
      fetch("/api/people/available")
        .then((res) => res.json())
        .then((data) => {
          // Filter out current person
          const filtered = (data.people || []).filter(
            (p: AvailablePerson) => p.id !== id
          );
          setAvailablePeople(filtered);
        })
        .catch(() => {
          showToast("Failed to load people", "error");
        });
    }
  }, [showCreateLink, id, showToast]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be less than 5MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      // Open the cropper instead of directly setting the image
      setImageToCrop(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Reset the input so the same file can be selected again
    e.target.value = "";
  };

  const handleCropComplete = useCallback((croppedImage: string) => {
    setAvatarImage(croppedImage);
    setImageToCrop(null);
  }, []);

  const handleCropCancel = useCallback(() => {
    setImageToCrop(null);
  }, []);

  const initials = getInitials(displayName);

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

    setIsSaving(true);

    try {
      const res = await fetch(`/api/people/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          type,
          avatarInitials: initials,
          avatarColor,
          avatarPath: avatarImage,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401) {
          setErrors((prev) => ({
            ...prev,
            currentPasscode: "Incorrect passcode",
          }));
          return;
        }
        throw new Error(data.error || "Failed to save");
      }

      showToast("Changes saved", "success");
      router.push(`/p/${id}/prayers`);
    } catch (error) {
      console.error("Error saving:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to save",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateLink = async () => {
    if (!selectedPerson) return;

    setIsCreatingLink(true);

    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person1Id: id,
          person2Id: selectedPerson,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create link");
      }

      showToast(
        "Link created successfully! You can now switch to it from the prayers page.",
        "success"
      );
      setShowCreateLink(false);
      setSelectedPerson(null);
      setLinkSearch("");

      // Refresh data to show new link
      const refreshRes = await fetch(`/api/people/${id}`);
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data.links) setLinks(data.links);
      }
    } catch (error) {
      console.error("Error creating link:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to create link",
        "error"
      );
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleDeleteLink = async () => {
    if (!linkToDelete) return;

    setIsDeletingLink(true);

    try {
      const res = await fetch(`/api/links/${linkToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete link");
      }

      showToast("Link deleted successfully", "success");
      setLinkToDelete(null);

      // Remove from local state
      setLinks((prev) => prev.filter((l) => l.id !== linkToDelete.id));
    } catch (error) {
      console.error("Error deleting link:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to delete link",
        "error"
      );
    } finally {
      setIsDeletingLink(false);
    }
  };

  // Filter available people by search
  const filteredPeople = availablePeople.filter((p) =>
    p.displayName.toLowerCase().includes(linkSearch.toLowerCase())
  );

  // Filter friends by search
  const filteredFriends = friends.filter((f) => {
    const fullName = f.user?.fullName || "";
    const username = f.user?.username || "";
    return (
      fullName.toLowerCase().includes(friendSearch.toLowerCase()) ||
      username.toLowerCase().includes(friendSearch.toLowerCase())
    );
  });

  const handleConnect = async () => {
    if (!selectedFriend) return;

    setIsConnecting(true);

    if (!currentUserId) {
      showToast("Please log in to connect profiles", "error");
      setIsConnecting(false);
      return;
    }

    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: id,
          connectedUserId: selectedFriend,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create connection");
      }

      const data = await res.json();
      setConnection(data.connection);
      showToast("Profile connected successfully!", "success");
      setShowConnectModal(false);
      setSelectedFriend(null);
      setFriendSearch("");
    } catch (error) {
      console.error("Error connecting:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to connect",
        "error"
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;

    try {
      const res = await fetch(`/api/connections/${connection.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to disconnect");
      }

      setConnection(null);
      showToast("Connection removed", "success");
    } catch (error) {
      console.error("Error disconnecting:", error);
      showToast("Failed to disconnect", "error");
    }
  };

  const handleDeleteProfile = async () => {
    if (
      !person ||
      deleteConfirmName.trim().toLowerCase() !==
        person.displayName.toLowerCase()
    ) {
      showToast("Please type the profile name to confirm", "error");
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/people/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to delete", "error");
        return;
      }

      showToast("Profile deleted successfully", "success");
      router.push("/");
    } catch (error) {
      console.error("Error deleting profile:", error);
      showToast("Failed to delete profile", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading || !person) {
    return (
      <div className="page-center">
        <div
          className="animate-pulse flex flex-col items-center"
          style={{ gap: "var(--space-md)" }}
        >
          <div
            className="bg-[var(--border-light)] rounded-full"
            style={{ width: "72px", height: "72px" }}
          />
          <div
            className="bg-[var(--border-light)] rounded"
            style={{ width: "100px", height: "20px" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Navbar />
      <AppHeader
        showBack
        backHref={`/p/${id}/prayers`}
        title={`Edit ${person.displayName}`}
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
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  {avatarImage ? (
                    <img
                      src={avatarImage}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

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
                    />
                  ))}
                </div>

                {showColorPicker && (
                  <div
                    className="bg-[var(--bg-secondary)] rounded-[var(--radius-md)]"
                    style={{
                      marginTop: "var(--space-md)",
                      padding: "var(--space-md)",
                    }}
                  >
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
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primary btn-full sm:flex-1"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>

          {/* Linked Prayers Section */}
          {person.type === "person" && (
            <div
              className="card card-elevated animate-fade-in"
              style={{ marginTop: "var(--space-xl)" }}
            >
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <h3
                  className="font-serif font-semibold text-[var(--text-primary)]"
                  style={{ fontSize: "var(--text-lg)" }}
                >
                  Linked Prayers
                  <button
                    type="button"
                    onClick={() => setShowLinkHelp(true)}
                    className="text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                    style={{
                      marginLeft: "var(--space-xs)",
                      padding: "2px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                    aria-label="What are linked prayers?"
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
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                </h3>
                <button
                  onClick={() => setShowCreateLink(true)}
                  className="btn btn-primary btn-sm"
                >
                  <svg
                    style={{ width: "16px", height: "16px" }}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Create Link
                </button>
              </div>

              <p
                className="text-[var(--text-muted)]"
                style={{
                  fontSize: "var(--text-sm)",
                  marginBottom: "var(--space-md)",
                }}
              >
                Create a shared prayer list between {person.displayName} and another person.
              </p>

              {links.length === 0 ? (
                <div
                  className="text-center bg-[var(--bg-secondary)] rounded-[var(--radius-md)]"
                  style={{ padding: "var(--space-lg)" }}
                >
                  <svg
                    className="mx-auto text-[var(--text-muted)]"
                    style={{
                      width: "32px",
                      height: "32px",
                      marginBottom: "var(--space-sm)",
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                  <p
                    className="text-[var(--text-muted)]"
                    style={{ fontSize: "var(--text-sm)" }}
                  >
                    No linked prayers yet
                  </p>
                </div>
              ) : (
                <div
                  className="flex flex-col"
                  style={{ gap: "var(--space-sm)" }}
                >
                  {links.map((link) => {
                    const otherPerson =
                      link.person1.id === id ? link.person2 : link.person1;
                    return (
                      <div
                        key={link.id}
                        className="flex items-center bg-[var(--bg-secondary)] rounded-[var(--radius-md)]"
                        style={{
                          padding: "var(--space-md)",
                          gap: "var(--space-md)",
                        }}
                      >
                        <AvatarCircle
                          name={otherPerson.displayName}
                          initials={otherPerson.avatarInitials || undefined}
                          color={otherPerson.avatarColor || undefined}
                          size="sm"
                          interactive={false}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-medium text-[var(--text-primary)] truncate"
                            style={{ fontSize: "var(--text-base)" }}
                          >
                            {link.displayName}
                          </p>
                          <p
                            className="text-[var(--text-muted)]"
                            style={{ fontSize: "var(--text-xs)" }}
                          >
                            {link.prayerCount} prayer
                            {link.prayerCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <svg
                          className="text-[var(--accent-primary)]"
                          style={{
                            width: "16px",
                            height: "16px",
                            flexShrink: 0,
                          }}
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <button
                          type="button"
                          onClick={() => setLinkToDelete(link)}
                          className="icon-btn"
                          style={{
                            color: "var(--error)",
                            padding: "var(--space-xs)",
                            flexShrink: 0,
                          }}
                          title="Delete link"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Connect Section - only show for person type */}
          {type === "person" && (
            <div style={{ marginTop: "var(--space-xl)" }}>
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <h3
                  className="font-serif font-semibold text-[var(--text-primary)] flex items-center"
                  style={{ fontSize: "var(--text-lg)" }}
                >
                  Connect to User
                  <button
                    type="button"
                    onClick={() => setShowConnectHelp(true)}
                    className="text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                    style={{
                      marginLeft: "var(--space-xs)",
                      padding: "2px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                    aria-label="What does connecting mean?"
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
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                </h3>
                {!connection && (
                  <button
                    type="button"
                    onClick={() => setShowConnectModal(true)}
                    className="btn btn-secondary"
                    style={{
                      fontSize: "var(--text-sm)",
                      padding: "var(--space-xs) var(--space-md)",
                    }}
                  >
                    <svg
                      style={{
                        width: "14px",
                        height: "14px",
                        marginRight: "4px",
                      }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    Connect
                  </button>
                )}
              </div>

              <p
                className="text-[var(--text-muted)]"
                style={{
                  fontSize: "var(--text-sm)",
                  marginBottom: "var(--space-md)",
                }}
              >
                Connect this profile to a friend&apos;s account. When they send
                you prayer requests, they&apos;ll be linked to this profile.
              </p>

              {connection ? (
                <div
                  className="flex items-center bg-[var(--accent-primary-light)] border border-[var(--accent-primary)] rounded-[var(--radius-md)]"
                  style={{ padding: "var(--space-md)", gap: "var(--space-md)" }}
                >
                  <div
                    className="rounded-full flex items-center justify-center text-white font-medium overflow-hidden"
                    style={{
                      width: "40px",
                      height: "40px",
                      fontSize: "var(--text-sm)",
                      backgroundColor: connection.connectedUser?.avatarPath
                        ? "transparent"
                        : connection.connectedUser?.avatarColor ||
                          "var(--accent-primary)",
                    }}
                  >
                    {connection.connectedUser?.avatarPath ? (
                      <img
                        src={connection.connectedUser.avatarPath}
                        alt={connection.connectedUser.fullName || "User"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      connection.connectedUser?.avatarInitials || "?"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--text-primary)] truncate">
                      {connection.connectedUser?.fullName || "Unknown User"}
                    </p>
                    <p
                      className="text-[var(--text-muted)]"
                      style={{ fontSize: "var(--text-xs)" }}
                    >
                      @{connection.connectedUser?.username || "unknown"}
                    </p>
                    {/* Sync Avatar Button */}
                    <button
                      type="button"
                      onClick={async () => {
                        // Sync all settings from connected user's account
                        if (connection.connectedUser) {
                          // Always sync avatar - use their image or clear to use initials
                          setAvatarImage(connection.connectedUser.avatarPath || null);
                          
                          // Always sync avatar color and initials
                          if (connection.connectedUser.avatarColor) {
                            setAvatarColor(connection.connectedUser.avatarColor);
                          }
                          
                          // Always sync the display name
                          if (connection.connectedUser.fullName) {
                            setDisplayName(connection.connectedUser.fullName);
                          }
                          
                          showToast(
                            "Synced with connected user's settings! Click Save to apply.",
                            "success"
                          );
                        }
                      }}
                      className="text-[var(--accent-primary)] hover:underline"
                      style={{ fontSize: "var(--text-xs)", marginTop: "4px" }}
                    >
                      Sync avatar style
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="text-[var(--text-muted)] hover:text-[var(--accent-danger)] transition-colors"
                    title="Remove connection"
                  >
                    <svg
                      style={{ width: "18px", height: "18px" }}
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
              ) : (
                <div
                  className="text-center bg-[var(--bg-secondary)] rounded-[var(--radius-md)]"
                  style={{ padding: "var(--space-lg)" }}
                >
                  <svg
                    className="mx-auto text-[var(--text-muted)]"
                    style={{
                      width: "32px",
                      height: "32px",
                      marginBottom: "var(--space-sm)",
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  <p
                    className="text-[var(--text-muted)]"
                    style={{ fontSize: "var(--text-sm)" }}
                  >
                    Not connected to any user account
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Danger Zone */}
          <div
            className="card"
            style={{
              marginTop: "var(--space-xl)",
              borderColor: "var(--error)",
              borderWidth: "1px",
              borderStyle: "solid",
            }}
          >
            <h3
              className="font-serif font-semibold"
              style={{
                fontSize: "var(--text-lg)",
                marginBottom: "var(--space-sm)",
                color: "var(--error)",
              }}
            >
              Danger Zone
            </h3>
            <p
              className="text-[var(--text-muted)]"
              style={{
                fontSize: "var(--text-sm)",
                marginBottom: "var(--space-md)",
              }}
            >
              Permanently delete this profile and all associated prayer
              requests. This action cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="btn btn-danger"
              style={{ fontSize: "var(--text-sm)" }}
            >
              <svg
                style={{ width: "16px", height: "16px", marginRight: "6px" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete Profile
            </button>
          </div>
        </div>
      </main>

      {/* Create Link Modal */}
      {showCreateLink && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ padding: "var(--space-md)" }}
        >
          <div
            className="card card-elevated w-full animate-scale-in"
            style={{ maxWidth: "480px", maxHeight: "90vh", overflow: "auto" }}
          >
            <div
              className="flex items-center"
              style={{
                gap: "var(--space-md)",
                marginBottom: "var(--space-lg)",
              }}
            >
              <div
                className="rounded-full bg-[var(--accent-primary-light)] flex items-center justify-center"
                style={{ width: "48px", height: "48px" }}
              >
                <svg
                  className="text-[var(--accent-primary)]"
                  style={{ width: "24px", height: "24px" }}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h2
                  className="font-serif font-semibold text-[var(--text-primary)]"
                  style={{ fontSize: "var(--text-xl)" }}
                >
                  Create Link
                </h2>
                <p
                  className="text-[var(--text-muted)]"
                  style={{ fontSize: "var(--text-sm)" }}
                >
                  Link {person.displayName} with another person
                </p>
              </div>
            </div>

            {/* Current person (auto-selected) */}
            <div style={{ marginBottom: "var(--space-lg)" }}>
              <label className="label">First Person</label>
              <div
                className="flex items-center bg-[var(--accent-primary-light)] border-2 border-[var(--accent-primary)] rounded-[var(--radius-md)]"
                style={{ padding: "var(--space-md)", gap: "var(--space-md)" }}
              >
                <AvatarCircle
                  name={person.displayName}
                  initials={person.avatarInitials || undefined}
                  color={person.avatarColor || undefined}
                  size="sm"
                  interactive={false}
                />
                <p className="font-medium text-[var(--text-primary)]">
                  {person.displayName}
                </p>
                <svg
                  className="ml-auto text-[var(--accent-primary)]"
                  style={{ width: "16px", height: "16px" }}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            {/* Select second person */}
            <div style={{ marginBottom: "var(--space-lg)" }}>
              <label className="label">Select Second Person</label>

              {/* Search */}
              <div
                className="relative"
                style={{ marginBottom: "var(--space-sm)" }}
              >
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  style={{ width: "16px", height: "16px" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  placeholder="Search people..."
                  className="input"
                  style={{ paddingLeft: "40px" }}
                />
              </div>

              {/* People list with scroll */}
              <div
                className="border border-[var(--border-light)] rounded-[var(--radius-md)] overflow-auto"
                style={{ maxHeight: "200px" }}
              >
                {filteredPeople.length === 0 ? (
                  <div
                    className="text-center text-[var(--text-muted)]"
                    style={{ padding: "var(--space-lg)" }}
                  >
                    {availablePeople.length === 0
                      ? "No people available to link"
                      : "No matching people"}
                  </div>
                ) : (
                  filteredPeople.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPerson(p.id)}
                      className={`w-full flex items-center transition-colors ${
                        selectedPerson === p.id
                          ? "bg-[var(--accent-primary-light)]"
                          : "hover:bg-[var(--bg-secondary)]"
                      }`}
                      style={{
                        padding: "var(--space-sm) var(--space-md)",
                        gap: "var(--space-md)",
                      }}
                    >
                      <AvatarCircle
                        name={p.displayName}
                        initials={p.avatarInitials || undefined}
                        color={p.avatarColor || undefined}
                        size="xs"
                        interactive={false}
                      />
                      <p className="font-medium text-[var(--text-primary)] flex-1 text-left">
                        {p.displayName}
                      </p>
                      {selectedPerson === p.id && (
                        <svg
                          className="text-[var(--accent-primary)]"
                          style={{ width: "16px", height: "16px" }}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div
              className="flex"
              style={{ gap: "var(--space-sm)", marginTop: "var(--space-lg)" }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowCreateLink(false);
                  setSelectedPerson(null);
                  setLinkSearch("");
                }}
                className="btn btn-secondary flex-1"
                disabled={isCreatingLink}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateLink}
                disabled={!selectedPerson || isCreatingLink}
                className="btn btn-primary flex-1"
              >
                {isCreatingLink ? "Creating..." : "Create Link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect Modal */}
      {showConnectModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ padding: "var(--space-md)" }}
        >
          <div
            className="card card-elevated w-full animate-scale-in"
            style={{ maxWidth: "480px", maxHeight: "90vh", overflow: "auto" }}
          >
            <div
              className="flex items-center"
              style={{
                gap: "var(--space-md)",
                marginBottom: "var(--space-lg)",
              }}
            >
              <div
                className="rounded-full bg-[var(--accent-primary-light)] flex items-center justify-center"
                style={{ width: "48px", height: "48px" }}
              >
                <svg
                  className="text-[var(--accent-primary)]"
                  style={{ width: "24px", height: "24px" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <div>
                <h2
                  className="font-serif font-semibold text-[var(--text-primary)]"
                  style={{ fontSize: "var(--text-xl)" }}
                >
                  Connect to User
                </h2>
                <p
                  className="text-[var(--text-muted)]"
                  style={{ fontSize: "var(--text-sm)" }}
                >
                  Link {person?.displayName} to a friend&apos;s account
                </p>
              </div>
            </div>

            {/* Profile being connected */}
            <div style={{ marginBottom: "var(--space-lg)" }}>
              <label className="label">Profile</label>
              <div
                className="flex items-center bg-[var(--accent-primary-light)] border-2 border-[var(--accent-primary)] rounded-[var(--radius-md)]"
                style={{ padding: "var(--space-md)", gap: "var(--space-md)" }}
              >
                <AvatarCircle
                  name={person?.displayName || ""}
                  initials={person?.avatarInitials || undefined}
                  color={person?.avatarColor || undefined}
                  size="sm"
                  interactive={false}
                />
                <p className="font-medium text-[var(--text-primary)]">
                  {person?.displayName}
                </p>
                <svg
                  className="ml-auto text-[var(--accent-primary)]"
                  style={{ width: "16px", height: "16px" }}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            {/* Select friend to connect */}
            <div style={{ marginBottom: "var(--space-lg)" }}>
              <label className="label">Select Friend</label>

              {/* Search */}
              <div
                className="relative"
                style={{ marginBottom: "var(--space-sm)" }}
              >
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  style={{ width: "16px", height: "16px" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="Search friends..."
                  className="input"
                  style={{ paddingLeft: "40px" }}
                />
              </div>

              {/* Friends list */}
              <div
                className="border border-[var(--border-light)] rounded-[var(--radius-md)] overflow-auto"
                style={{ maxHeight: "200px" }}
              >
                {isLoadingFriends ? (
                  <div
                    className="text-center text-[var(--text-muted)]"
                    style={{ padding: "var(--space-lg)" }}
                  >
                    Loading friends...
                  </div>
                ) : filteredFriends.length === 0 ? (
                  <div
                    className="text-center text-[var(--text-muted)]"
                    style={{ padding: "var(--space-lg)" }}
                  >
                    {friends.length === 0
                      ? "No friends yet. Add friends first to connect profiles."
                      : "No matching friends"}
                  </div>
                ) : (
                  filteredFriends.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedFriend(f.user?.id || f.id)}
                      className={`w-full flex items-center transition-colors ${
                        selectedFriend === (f.user?.id || f.id)
                          ? "bg-[var(--accent-primary-light)]"
                          : "hover:bg-[var(--bg-secondary)]"
                      }`}
                      style={{
                        padding: "var(--space-sm) var(--space-md)",
                        gap: "var(--space-md)",
                      }}
                    >
                      <div
                        className="rounded-full flex items-center justify-center text-white font-medium overflow-hidden"
                        style={{
                          width: "32px",
                          height: "32px",
                          fontSize: "var(--text-xs)",
                          backgroundColor: f.user?.avatarPath
                            ? "transparent"
                            : f.user?.avatarColor || "var(--accent-primary)",
                        }}
                      >
                        {f.user?.avatarPath ? (
                          <img
                            src={f.user.avatarPath}
                            alt={f.user.fullName || "Friend"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          f.user?.avatarInitials || "?"
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium text-[var(--text-primary)] truncate">
                          {f.user?.fullName || "Unknown"}
                        </p>
                        <p
                          className="text-[var(--text-muted)]"
                          style={{ fontSize: "var(--text-xs)" }}
                        >
                          @{f.user?.username || "unknown"}
                        </p>
                      </div>
                      {selectedFriend === (f.user?.id || f.id) && (
                        <svg
                          className="text-[var(--accent-primary)]"
                          style={{ width: "16px", height: "16px" }}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            <p
              className="text-[var(--text-muted)] bg-[var(--bg-secondary)] rounded-[var(--radius-md)]"
              style={{
                fontSize: "var(--text-xs)",
                padding: "var(--space-sm) var(--space-md)",
                marginBottom: "var(--space-lg)",
              }}
            >
              💡 When this friend sends you a prayer request, it will
              automatically be linked to this profile.
            </p>

            <div className="flex" style={{ gap: "var(--space-sm)" }}>
              <button
                type="button"
                onClick={() => {
                  setShowConnectModal(false);
                  setSelectedFriend(null);
                  setFriendSearch("");
                }}
                className="btn btn-secondary flex-1"
                disabled={isConnecting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConnect}
                disabled={!selectedFriend || isConnecting}
                className="btn btn-primary flex-1"
              >
                {isConnecting ? "Connecting..." : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && person && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ padding: "var(--space-md)" }}
        >
          <div
            className="card card-elevated w-full animate-scale-in"
            style={{ maxWidth: "420px" }}
          >
            <div
              className="flex items-center"
              style={{
                gap: "var(--space-md)",
                marginBottom: "var(--space-lg)",
              }}
            >
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: "48px",
                  height: "48px",
                  background: "rgba(239, 68, 68, 0.15)",
                }}
              >
                <svg
                  style={{
                    width: "24px",
                    height: "24px",
                    color: "var(--error)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h2
                  className="font-serif font-semibold text-[var(--text-primary)]"
                  style={{ fontSize: "var(--text-xl)" }}
                >
                  Delete Profile
                </h2>
                <p
                  className="text-[var(--text-muted)]"
                  style={{ fontSize: "var(--text-sm)" }}
                >
                  This action is permanent
                </p>
              </div>
            </div>

            <div
              className="bg-[var(--bg-secondary)] rounded-[var(--radius-md)]"
              style={{
                padding: "var(--space-md)",
                marginBottom: "var(--space-lg)",
              }}
            >
              <p
                className="text-[var(--text-secondary)]"
                style={{
                  fontSize: "var(--text-sm)",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                This will permanently delete{" "}
                <strong className="text-[var(--text-primary)]">
                  {person.displayName}
                </strong>{" "}
                and all their prayer requests. This cannot be undone.
              </p>
              <p
                className="text-[var(--text-muted)]"
                style={{
                  fontSize: "var(--text-sm)",
                  marginTop: "var(--space-sm)",
                }}
              >
                But don&apos;t worry! You can always make another one :)
              </p>
            </div>

            <div style={{ marginBottom: "var(--space-lg)" }}>
              <label className="label">
                Type &quot;{person.displayName}&quot; to confirm
              </label>
              <input
                type="text"
                className="input"
                placeholder={person.displayName}
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="flex" style={{ gap: "var(--space-sm)" }}>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmName("");
                }}
                className="btn btn-secondary flex-1"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProfile}
                disabled={
                  isDeleting ||
                  deleteConfirmName.trim().toLowerCase() !==
                    person.displayName.toLowerCase()
                }
                className="btn btn-danger flex-1"
              >
                {isDeleting ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Delete Confirmation Modal */}
      {linkToDelete && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ padding: "var(--space-md)" }}
        >
          <div
            className="card card-elevated w-full animate-scale-in"
            style={{ maxWidth: "420px" }}
          >
            <div
              className="flex items-center"
              style={{
                gap: "var(--space-md)",
                marginBottom: "var(--space-lg)",
              }}
            >
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: "48px",
                  height: "48px",
                  background: "rgba(239, 68, 68, 0.15)",
                }}
              >
                <svg
                  style={{
                    width: "24px",
                    height: "24px",
                    color: "var(--error)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <div>
                <h2
                  className="font-serif font-semibold text-[var(--text-primary)]"
                  style={{ fontSize: "var(--text-xl)" }}
                >
                  Delete Link
                </h2>
                <p
                  className="text-[var(--text-muted)]"
                  style={{ fontSize: "var(--text-sm)" }}
                >
                  This will remove the shared prayer list
                </p>
              </div>
            </div>

            <div
              className="bg-[var(--bg-secondary)] rounded-[var(--radius-md)]"
              style={{
                padding: "var(--space-md)",
                marginBottom: "var(--space-lg)",
              }}
            >
              <p
                className="text-[var(--text-secondary)]"
                style={{
                  fontSize: "var(--text-sm)",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                This will permanently delete the link{" "}
                <strong className="text-[var(--text-primary)]">
                  &quot;{linkToDelete.displayName}&quot;
                </strong>{" "}
                and all prayers in the shared list. This cannot be undone.
              </p>
            </div>

            <div className="flex" style={{ gap: "var(--space-sm)" }}>
              <button
                type="button"
                onClick={() => setLinkToDelete(null)}
                className="btn btn-secondary flex-1"
                disabled={isDeletingLink}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteLink}
                disabled={isDeletingLink}
                className="btn btn-danger flex-1"
              >
                {isDeletingLink ? "Deleting..." : "Delete Link"}
              </button>
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
          entityId={id}
        />
      )}

      {/* Linked Prayers Help Modal */}
      {showLinkHelp && (
        <div
          className="fixed inset-0 flex items-center justify-center animate-fade-in"
          style={{
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 9999,
            padding: "var(--space-md)",
          }}
          onClick={() => setShowLinkHelp(false)}
        >
          <div
            className="card card-elevated animate-scale-in"
            style={{
              maxWidth: "400px",
              width: "100%",
              padding: "var(--space-xl)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center"
              style={{
                marginBottom: "var(--space-md)",
                gap: "var(--space-sm)",
              }}
            >
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: "40px",
                  height: "40px",
                  background: "var(--accent-primary-light)",
                }}
              >
                <svg
                  className="text-[var(--accent-primary)]"
                  style={{ width: "20px", height: "20px" }}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{ fontSize: "var(--text-lg)" }}
              >
                What are Linked Prayers?
              </h3>
            </div>
            <p
              className="text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-relaxed)",
                marginBottom: "var(--space-md)",
              }}
            >
              Linked prayers create a shared prayer list between two people.
            </p>
            <p
              className="text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-relaxed)",
                marginBottom: "var(--space-md)",
              }}
            >
              <strong>For example:</strong> Link two people who are married! That way you have their individual prayer lists AND a shared list for prayers about them together.
            </p>
            <p
              className="text-[var(--text-muted)]"
              style={{
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-relaxed)",
                marginBottom: "var(--space-lg)",
              }}
            >
              You can switch between individual and linked lists by tapping the arrow next to their name.
            </p>
            <button
              onClick={() => setShowLinkHelp(false)}
              className="btn btn-primary btn-full"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Connect to User Help Modal */}
      {showConnectHelp && (
        <div
          className="fixed inset-0 flex items-center justify-center animate-fade-in"
          style={{
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 9999,
            padding: "var(--space-md)",
          }}
          onClick={() => setShowConnectHelp(false)}
        >
          <div
            className="card card-elevated animate-scale-in"
            style={{
              maxWidth: "400px",
              width: "100%",
              padding: "var(--space-xl)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center"
              style={{
                marginBottom: "var(--space-md)",
                gap: "var(--space-sm)",
              }}
            >
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: "40px",
                  height: "40px",
                  background: "var(--accent-primary-light)",
                }}
              >
                <svg
                  className="text-[var(--accent-primary)]"
                  style={{ width: "20px", height: "20px" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <h3
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{ fontSize: "var(--text-lg)" }}
              >
                What is Connecting?
              </h3>
            </div>
            <p
              className="text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-relaxed)",
                marginBottom: "var(--space-md)",
              }}
            >
              Connecting links this profile to a friend&apos;s Love1Another account.
            </p>
            <p
              className="text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-relaxed)",
                marginBottom: "var(--space-md)",
              }}
            >
              <strong>How it works:</strong> When your connected friend sends you a prayer request in a message, you can add it directly to their profile with one tap!
            </p>
            <p
              className="text-[var(--text-muted)]"
              style={{
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-relaxed)",
                marginBottom: "var(--space-lg)",
              }}
            >
              This is optional - you can always add prayers manually too.
            </p>
            <button
              onClick={() => setShowConnectHelp(false)}
              className="btn btn-primary btn-full"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
