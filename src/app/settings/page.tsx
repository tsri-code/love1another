"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/components/AuthGuard";
import { useToast } from "@/lib/toast";
import { createClient } from "@/lib/supabase";
import { ImageCropper } from "@/components/ImageCropper";
import {
  Alert,
  AlertTitle,
  CheckCircleIcon,
  AlertCircleIcon,
} from "@/components/ui/alert";
import { useNotifications } from "@/lib/use-notifications";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const {
    messageSoundEnabled,
    friendRequestSoundEnabled,
    setMessageSoundEnabled,
    setFriendRequestSoundEnabled,
  } = useNotifications();

  // Profile edit state
  const [displayName, setDisplayName] = useState("");
  const [usernameValue, setUsernameValue] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Username validation state
  const [usernameError, setUsernameError] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Account deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Avatar state
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setDisplayName(user.fullName || "");
      setUsernameValue(user.username || "");
      setOriginalUsername(user.username || "");
      setEmailValue(user.email || "");
      setAvatarPath(user.avatarPath || null);
    }
  }, [user]);

  const userName = user?.fullName || "User";
  const avatarColor = user?.avatarColor || "#7c9bb8";

  // Validate username format
  const validateUsername = (uname: string): string | null => {
    if (uname.length < 5) {
      return "Username must be at least 5 characters";
    }
    if (uname.length > 30) {
      return "Username must be 30 characters or less";
    }
    if (!/^[a-z0-9_]+$/.test(uname)) {
      return "Username can only contain lowercase letters, numbers, and underscores";
    }
    return null;
  };

  // Check username availability when changed
  useEffect(() => {
    const normalizedUsername = usernameValue.toLowerCase().trim();

    // If same as original, no need to check
    if (normalizedUsername === originalUsername.toLowerCase()) {
      setUsernameAvailable(true);
      setUsernameError("");
      return;
    }

    if (!normalizedUsername) {
      setUsernameAvailable(null);
      setUsernameError("");
      return;
    }

    const validationError = validateUsername(normalizedUsername);
    if (validationError) {
      setUsernameError(validationError);
      setUsernameAvailable(false);
      return;
    }

    setIsCheckingUsername(true);
    setUsernameError("");

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/check-username?username=${encodeURIComponent(
            normalizedUsername
          )}`
        );
        const data = await res.json();
        setUsernameAvailable(data.available);
        if (!data.available && data.error) {
          setUsernameError(data.error);
        }
      } catch {
        setUsernameError("Failed to check username");
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [usernameValue, originalUsername]);

  const handleSaveProfile = async () => {
    setProfileError("");
    setIsSavingProfile(true);

    try {
      // Validate display name
      if (!displayName.trim()) {
        setProfileError("Display name is required");
        setIsSavingProfile(false);
        return;
      }

      // Validate username
      const normalizedUsername = usernameValue.toLowerCase().trim();
      const usernameValidationError = validateUsername(normalizedUsername);
      if (usernameValidationError) {
        setProfileError(usernameValidationError);
        setIsSavingProfile(false);
        return;
      }

      // Check if username is available (if changed)
      if (
        normalizedUsername !== originalUsername.toLowerCase() &&
        !usernameAvailable
      ) {
        setProfileError("Please choose an available username");
        setIsSavingProfile(false);
        return;
      }

      if (!emailValue.includes("@")) {
        setProfileError("Valid email is required");
        return;
      }

      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: displayName.trim(),
          username: usernameValue.trim(),
          email: emailValue.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }

      showToast("Profile updated successfully", "success");

      // Refresh the page to update auth context
      window.location.reload();
    } catch (error) {
      console.error("Error saving profile:", error);
      setProfileError(
        error instanceof Error ? error.message : "Failed to save profile"
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 6) {
      return "Password must be at least 6 characters";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return "Password must contain at least one symbol";
    }
    return null;
  };

  const handlePasswordChange = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    // Validate new password
    const validationError = validatePassword(newPassword);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    try {
      const supabase = createClient();

      // First verify current password by attempting sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError("Current password is incorrect");
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message || "Failed to update password");
        return;
      }

      setPasswordSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordChange(false);
        setPasswordSuccess("");
      }, 2000);
    } catch (error) {
      console.error("Password change error:", error);
      setPasswordError("An error occurred while changing password");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      showToast("Please type DELETE to confirm", "error");
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch("/api/users/delete-account", {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete account");
      }

      showToast("Account deleted successfully", "success");

      // Sign out and redirect
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Delete account error:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to delete account",
        "error"
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
    }
  };

  const getInitials = (name: string): string => {
    if (!name || name.trim() === "") return "?";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return name.substring(0, 2).toUpperCase();
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be less than 5MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageToCrop(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropComplete = async (imageUrl: string) => {
    setAvatarPath(imageUrl);
    setImageToCrop(null);

    // Save to user metadata
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarPath: imageUrl }),
      });

      if (res.ok) {
        showToast("Profile picture updated!", "success");
      }
    } catch {
      console.error("Failed to save avatar");
    }
  };

  return (
    <div className="page">
      <Navbar />

      <main className="flex-1">
        <div className="container" style={{ maxWidth: "600px" }}>
          <section
            style={{
              paddingTop: "var(--space-xl)",
              paddingBottom: "var(--space-xl)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center"
              style={{
                marginBottom: "var(--space-xl)",
                gap: "var(--space-md)",
              }}
            >
              <button className="icon-btn" onClick={() => router.push("/")}>
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <h1
                className="font-serif font-bold"
                style={{ fontSize: "var(--text-2xl)" }}
              >
                Settings
              </h1>
            </div>

            {/* Profile Section */}
            <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
              <h2
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-lg)",
                }}
              >
                Profile
              </h2>

              {/* Avatar */}
              <div
                className="flex items-center"
                style={{
                  marginBottom: "var(--space-xl)",
                  gap: "var(--space-lg)",
                }}
              >
                <div className="relative">
                  <div
                    className="rounded-full flex items-center justify-center overflow-hidden"
                    style={{
                      width: "72px",
                      height: "72px",
                      background: avatarPath ? "transparent" : avatarColor,
                      color: "white",
                      fontWeight: "600",
                      fontSize: "var(--text-xl)",
                    }}
                  >
                    {avatarPath ? (
                      <img
                        src={avatarPath}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getInitials(userName)
                    )}
                  </div>
                  {/* Camera button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 rounded-full bg-[var(--surface-primary)] border-2 border-[var(--bg-primary)] shadow-md hover:bg-[var(--bg-secondary)] transition-colors flex items-center justify-center"
                    style={{ width: "28px", height: "28px" }}
                    title="Upload photo"
                  >
                    <svg
                      className="text-[var(--text-secondary)]"
                      style={{ width: "14px", height: "14px" }}
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
                <div>
                  <p
                    className="font-semibold text-[var(--text-primary)]"
                    style={{ fontSize: "var(--text-lg)" }}
                  >
                    {userName}
                  </p>
                  <p
                    className="text-[var(--text-muted)]"
                    style={{ fontSize: "var(--text-sm)" }}
                  >
                    Member since January 2026
                  </p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="form-group">
                <label className="label">Display Name</label>
                <input
                  type="text"
                  className="input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                />
              </div>

              <div className="form-group">
                <label className="label">Username</label>
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }}
                  >
                    @
                  </span>
                  <input
                    type="text"
                    className="input"
                    value={usernameValue}
                    onChange={(e) =>
                      setUsernameValue(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                      )
                    }
                    placeholder="your_username"
                    style={{
                      paddingLeft: "28px",
                      paddingRight: "40px",
                      borderColor: usernameError
                        ? "var(--error)"
                        : usernameAvailable === true
                        ? "var(--success)"
                        : undefined,
                    }}
                  />
                  {isCheckingUsername && (
                    <div
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "16px",
                        height: "16px",
                        border: "2px solid var(--text-muted)",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  )}
                  {!isCheckingUsername &&
                    usernameAvailable === true &&
                    usernameValue.length >= 5 && (
                      <div
                        style={{
                          position: "absolute",
                          right: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--success)",
                        }}
                      >
                        ✓
                      </div>
                    )}
                  {!isCheckingUsername &&
                    usernameAvailable === false &&
                    usernameValue.length >= 5 && (
                      <div
                        style={{
                          position: "absolute",
                          right: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--error)",
                        }}
                      >
                        ✗
                      </div>
                    )}
                </div>
                {usernameError ? (
                  <p
                    className="form-error"
                    style={{ marginTop: "var(--space-xs)" }}
                  >
                    {usernameError}
                  </p>
                ) : (
                  <p className="form-hint">
                    Min 5 chars: lowercase letters, numbers, and underscores
                    only
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>

              {profileError && (
                <div style={{ marginBottom: "var(--space-md)" }}>
                  <Alert variant="destructive" icon={<AlertCircleIcon />}>
                    <AlertTitle>{profileError}</AlertTitle>
                  </Alert>
                </div>
              )}

              <button
                className="btn btn-primary"
                style={{ marginTop: "var(--space-sm)" }}
                onClick={handleSaveProfile}
                disabled={
                  isSavingProfile ||
                  isCheckingUsername ||
                  (usernameValue !== originalUsername && !usernameAvailable)
                }
              >
                {isSavingProfile ? "Saving..." : "Save Changes"}
              </button>
            </div>

            {/* Password Section */}
            <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <h2
                  className="font-serif font-semibold text-[var(--text-primary)]"
                  style={{ fontSize: "var(--text-lg)" }}
                >
                  Password
                </h2>
                {!showPasswordChange && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowPasswordChange(true)}
                  >
                    Change Password
                  </button>
                )}
              </div>

              {showPasswordChange ? (
                <div className="animate-fade-in">
                  <div className="form-group">
                    <label className="label">Current Password</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">New Password</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <p className="form-hint">
                      Min 6 characters with uppercase, lowercase, number, and
                      symbol
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="label">Confirm New Password</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>

                  {passwordError && (
                    <div style={{ marginBottom: "var(--space-md)" }}>
                      <Alert variant="destructive" icon={<AlertCircleIcon />}>
                        <AlertTitle>{passwordError}</AlertTitle>
                      </Alert>
                    </div>
                  )}

                  {passwordSuccess && (
                    <div style={{ marginBottom: "var(--space-md)" }}>
                      <Alert variant="success" icon={<CheckCircleIcon />}>
                        <AlertTitle>{passwordSuccess}</AlertTitle>
                      </Alert>
                    </div>
                  )}

                  <div
                    className="flex items-center"
                    style={{ gap: "var(--space-sm)" }}
                  >
                    <button
                      className="btn btn-primary"
                      onClick={handlePasswordChange}
                    >
                      Update Password
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setShowPasswordChange(false);
                        setPasswordError("");
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  className="text-[var(--text-muted)]"
                  style={{ fontSize: "var(--text-sm)" }}
                >
                  ••••••••••
                </p>
              )}
            </div>

            {/* Friends Section */}
            <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <h2
                  className="font-serif font-semibold text-[var(--text-primary)]"
                  style={{ fontSize: "var(--text-lg)" }}
                >
                  Friends
                </h2>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => router.push("/friends")}
                >
                  Manage Friends
                </button>
              </div>
              <p
                className="text-[var(--text-muted)]"
                style={{ fontSize: "var(--text-sm)" }}
              >
                Connect with other users and link their profiles to your prayer
                list.
              </p>
            </div>

            {/* Notification Settings */}
            <div className="card">
              <h2
                className="font-serif font-semibold"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                }}
              >
                Notification Sounds
              </h2>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-md)",
                }}
              >
                {/* Message Sound Toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--space-sm) 0",
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 500 }}>New Message Sound</p>
                    <p
                      className="text-[var(--text-muted)]"
                      style={{ fontSize: "var(--text-sm)" }}
                    >
                      Play a sound when you receive a new message
                    </p>
                  </div>
                  <label
                    style={{
                      position: "relative",
                      display: "inline-block",
                      width: "48px",
                      height: "24px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={messageSoundEnabled}
                      onChange={(e) => setMessageSoundEnabled(e.target.checked)}
                      style={{
                        opacity: 0,
                        width: 0,
                        height: 0,
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        cursor: "pointer",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: messageSoundEnabled
                          ? "var(--primary)"
                          : "var(--bg-secondary)",
                        transition: "0.3s",
                        borderRadius: "24px",
                        border: "1px solid var(--border-light)",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          content: '""',
                          height: "18px",
                          width: "18px",
                          left: messageSoundEnabled ? "26px" : "3px",
                          bottom: "2px",
                          backgroundColor: "white",
                          transition: "0.3s",
                          borderRadius: "50%",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                        }}
                      />
                    </span>
                  </label>
                </div>

                {/* Friend Request Sound Toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--space-sm) 0",
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 500 }}>Friend Request Sound</p>
                    <p
                      className="text-[var(--text-muted)]"
                      style={{ fontSize: "var(--text-sm)" }}
                    >
                      Play a sound for friend request notifications
                    </p>
                  </div>
                  <label
                    style={{
                      position: "relative",
                      display: "inline-block",
                      width: "48px",
                      height: "24px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={friendRequestSoundEnabled}
                      onChange={(e) =>
                        setFriendRequestSoundEnabled(e.target.checked)
                      }
                      style={{
                        opacity: 0,
                        width: 0,
                        height: 0,
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        cursor: "pointer",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: friendRequestSoundEnabled
                          ? "var(--primary)"
                          : "var(--bg-secondary)",
                        transition: "0.3s",
                        borderRadius: "24px",
                        border: "1px solid var(--border-light)",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          content: '""',
                          height: "18px",
                          width: "18px",
                          left: friendRequestSoundEnabled ? "26px" : "3px",
                          bottom: "2px",
                          backgroundColor: "white",
                          transition: "0.3s",
                          borderRadius: "50%",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                        }}
                      />
                    </span>
                  </label>
                </div>
              </div>

              <p
                className="text-[var(--text-muted)]"
                style={{
                  fontSize: "var(--text-sm)",
                  marginTop: "var(--space-md)",
                }}
              >
                Note: Browser notifications require your permission. Notification
                counts will still appear in the tab title even if sounds are
                disabled.
              </p>
            </div>

            {/* Danger Zone */}
            <div className="card" style={{ borderColor: "var(--error)" }}>
              <h2
                className="font-serif font-semibold"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-sm)",
                  color: "var(--error)",
                }}
              >
                Danger Zone
              </h2>

              {!showDeleteConfirm ? (
                <>
                  <p
                    className="text-[var(--text-muted)]"
                    style={{
                      fontSize: "var(--text-sm)",
                      marginBottom: "var(--space-md)",
                    }}
                  >
                    Once you delete your account, there is no going back. All
                    your profiles, prayers, and data will be permanently
                    deleted.
                  </p>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete Account
                  </button>
                </>
              ) : (
                <>
                  <p
                    className="text-[var(--text-primary)]"
                    style={{
                      fontSize: "var(--text-sm)",
                      marginBottom: "var(--space-md)",
                      fontWeight: 500,
                    }}
                  >
                    Are you absolutely sure? This action cannot be undone.
                  </p>
                  <div
                    className="form-group"
                    style={{ marginBottom: "var(--space-md)" }}
                  >
                    <label className="label" style={{ color: "var(--error)" }}>
                      Type DELETE to confirm
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="DELETE"
                      value={deleteConfirmText}
                      onChange={(e) =>
                        setDeleteConfirmText(e.target.value.toUpperCase())
                      }
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex" style={{ gap: "var(--space-sm)" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText("");
                      }}
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={handleDeleteAccount}
                      disabled={isDeleting || deleteConfirmText !== "DELETE"}
                    >
                      {isDeleting
                        ? "Deleting..."
                        : "Permanently Delete Account"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Image Cropper */}
      {imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => setImageToCrop(null)}
          aspectRatio={1}
          entityType="user"
          entityId={user?.id || "user"}
        />
      )}
    </div>
  );
}
