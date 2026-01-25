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
import { PWAInstructions } from "@/components/PWAInstructions";
import { PasswordInput } from "@/components/PasswordInput";
import { useCrypto } from "@/lib/use-crypto";
import { ViewRecoveryCode } from "@/components/RecoverySetup";
import { E2EEKeys } from "@/lib/dek-crypto";

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

  // Encryption state
  const { getRecoveryCode, changePasswordWithDEK, restoreWithRecovery } = useCrypto();
  const [showViewRecoveryCode, setShowViewRecoveryCode] = useState(false);
  const [recoveryCodeToView, setRecoveryCodeToView] = useState<string | null>(null);
  const [showRestoreEncryption, setShowRestoreEncryption] = useState(false);
  const [encryptionPasswordInput, setEncryptionPasswordInput] = useState("");
  const [encryptionError, setEncryptionError] = useState("");
  const [e2eeKeys, setE2eeKeys] = useState<E2EEKeys | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restorePasswordInput, setRestorePasswordInput] = useState("");
  const [showRecoveryInfoModal, setShowRecoveryInfoModal] = useState(false);

  // OTP verification state
  const [otpStep, setOtpStep] = useState<"password" | "otp">("password");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState("");

  // Share/Invite state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareSending, setShareSending] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  // Load E2EE keys
  useEffect(() => {
    const loadE2eeKeys = async () => {
      if (!user) return;
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("user_e2ee_keys")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(); // Use maybeSingle to handle 0 rows gracefully

        if (error) {
          console.warn("Could not load E2EE keys:", error);
          return;
        }

        if (data) {
          setE2eeKeys({
            userId: data.user_id,
            version: data.version,
            wrappedDekPassword: data.wrapped_dek_password,
            passwordKdfSalt: data.password_kdf_salt,
            wrappedDekRecovery: data.wrapped_dek_recovery,
            recoveryKdfSalt: data.recovery_kdf_salt,
            encryptedRecoveryCode: data.encrypted_recovery_code,
            migrationState: data.migration_state,
          });
        }
      } catch {
        // Keys not set up yet
      }
    };
    loadE2eeKeys();
  }, [user]);

  // Handle view recovery code (two-step: password + OTP via reauthenticate)
  const [isVerifying, setIsVerifying] = useState(false);

  const handleViewRecoveryCode = async () => {
    setEncryptionError("");
    setOtpError("");

    const supabase = createClient();

    if (otpStep === "password") {
      // Step 1: Verify password and send OTP via reauthenticate
      setOtpSending(true);
      try {
        // First verify the password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user?.email || "",
          password: encryptionPasswordInput,
        });

        if (signInError) {
          setEncryptionError("Incorrect password. Please try again.");
          setOtpSending(false);
          return;
        }

        // Send reauthentication nonce (OTP) to user's email
        const { error: reauthError } = await supabase.auth.reauthenticate();

        if (reauthError) {
          setEncryptionError("Failed to send verification code. Please try again.");
          setOtpSending(false);
          return;
        }

        // Move to OTP step
        setOtpStep("otp");
        showToast("Verification code sent to your email", "success");
      } catch {
        setEncryptionError("An error occurred. Please try again.");
      } finally {
        setOtpSending(false);
      }
    } else {
      // Step 2: Verify OTP nonce and show recovery code
      setIsVerifying(true);
      try {
        // Verify the nonce
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: user?.email || "",
          token: otpCode,
          type: "email",
        });

        if (verifyError) {
          setOtpError("Invalid or expired code. Please try again.");
          setIsVerifying(false);
          return;
        }

        // Both password and OTP verified - decrypt and show recovery code
        if (e2eeKeys) {
          const code = await getRecoveryCode(e2eeKeys, encryptionPasswordInput);
          setRecoveryCodeToView(code);
        }

        // Reset all inputs
        setEncryptionPasswordInput("");
        setOtpCode("");
        setOtpStep("password");
      } catch {
        setOtpError("Failed to verify code. Please try again.");
      } finally {
        setIsVerifying(false);
      }
    }
  };

  // Reset view recovery code modal state
  const resetViewRecoveryModal = () => {
    setShowViewRecoveryCode(false);
    setEncryptionPasswordInput("");
    setOtpCode("");
    setOtpStep("password");
    setEncryptionError("");
    setOtpError("");
  };

  // Handle share/invite
  const handleShareInvite = async () => {
    if (!shareEmail) return;

    setShareSending(true);
    setShareError("");

    try {
      // Send invite email using Supabase Admin API (via our API route)
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: shareEmail,
          inviterName: user?.fullName || "A friend",
          inviterUsername: user?.username || "",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invitation");
      }

      setShareSuccess(true);
      setShareEmail("");
      showToast("Invitation sent successfully!", "success");
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Failed to send invitation");
    } finally {
      setShareSending(false);
    }
  };

  // Copy share link to clipboard
  const handleCopyShareLink = async () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const shareText = `Hey! Can I pray for you? Sign up on Love1Another and add me: ${user?.username || ""}`;
    const shareUrl = `${baseUrl}/login?ref=${user?.username || ""}`;

    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setShareLinkCopied(true);
      showToast("Link copied to clipboard!", "success");
      setTimeout(() => setShareLinkCopied(false), 3000);
    } catch {
      showToast("Failed to copy link", "error");
    }
  };

  // Reset share modal
  const resetShareModal = () => {
    setShowShareModal(false);
    setShareEmail("");
    setShareError("");
    setShareSuccess(false);
  };

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

      // Update password in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message || "Failed to update password");
        return;
      }

      // Re-wrap DEK with new password if user has upgraded encryption
      if (e2eeKeys && e2eeKeys.migrationState === "upgraded") {
        try {
          const updatedKeys = await changePasswordWithDEK(
            e2eeKeys,
            currentPassword,
            newPassword
          );

          // Save updated E2EE keys to database
          const res = await fetch("/api/users/e2ee-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              wrappedDekPassword: updatedKeys.wrappedDekPassword,
              passwordKdfSalt: updatedKeys.passwordKdfSalt,
              encryptedRecoveryCode: updatedKeys.encryptedRecoveryCode,
              // Keep existing recovery-related fields unchanged
              wrappedDekRecovery: updatedKeys.wrappedDekRecovery,
              recoveryKdfSalt: updatedKeys.recoveryKdfSalt,
              migrationState: updatedKeys.migrationState,
            }),
          });

          if (!res.ok) {
            console.error("Failed to save updated E2EE keys");
            // Password is already changed, but encryption keys weren't updated
            // This is a critical issue - show warning
            setPasswordError(
              "Password changed but encryption keys failed to update. Please restore from recovery code."
            );
            return;
          }

          // Update local state with new keys
          setE2eeKeys({
            ...e2eeKeys,
            wrappedDekPassword: updatedKeys.wrappedDekPassword,
            passwordKdfSalt: updatedKeys.passwordKdfSalt,
            encryptedRecoveryCode: updatedKeys.encryptedRecoveryCode,
          });
        } catch (dekError) {
          console.error("Failed to re-wrap DEK:", dekError);
          setPasswordError(
            "Password changed but encryption keys failed to update. Please restore from recovery code."
          );
          return;
        }
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

      // Clear local auth state and redirect
      // Note: signOut may fail with 403 since user no longer exists - that's expected
      const supabase = createClient();
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Ignore - user is already deleted, just clear local state
      }
      
      // Clear any remaining local storage
      if (typeof window !== "undefined") {
        localStorage.removeItem("rememberMe");
        sessionStorage.clear();
      }
      
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
                    <PasswordInput
                      className="input"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">New Password</label>
                    <PasswordInput
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
                    <PasswordInput
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

            {/* Encryption & Recovery Section */}
            <div className="card" style={{ marginBottom: "var(--space-lg)", padding: "var(--space-lg)" }}>
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: "var(--space-lg)" }}
              >
                <div className="flex items-center gap-3">
                  <h2
                    className="font-serif font-semibold text-[var(--text-primary)]"
                    style={{ fontSize: "var(--text-lg)" }}
                  >
                    Encryption & Recovery
                  </h2>
                  <button
                    onClick={() => setShowRecoveryInfoModal(true)}
                    className="pulse-glow-icon flex items-center justify-center w-8 h-8 rounded-full"
                    style={{
                      backgroundColor: "rgba(239, 68, 68, 0.2)",
                      border: "2px solid rgba(239, 68, 68, 0.4)",
                    }}
                    aria-label="Learn about recovery codes"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="#ef4444"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                  </button>
                </div>
              </div>

              <p
                className="text-[var(--text-secondary)]"
                style={{
                  fontSize: "var(--text-sm)",
                  marginBottom: "var(--space-lg)",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                Your messages and prayers are end-to-end encrypted. Only you can read them.
                Your recovery code lets you restore access after a password reset.
              </p>

              {/* Status */}
              <div
                className="flex items-center gap-3 p-4 rounded-lg"
                style={{
                  backgroundColor: "var(--surface-elevated)",
                  marginBottom: "var(--space-lg)",
                }}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      e2eeKeys?.migrationState === "upgraded"
                        ? "var(--success)"
                        : e2eeKeys
                        ? "var(--warning)"
                        : "var(--text-muted)",
                  }}
                />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                  {e2eeKeys?.migrationState === "upgraded"
                    ? "Encryption active, recovery code set"
                    : e2eeKeys
                    ? "Encryption active, recovery not set"
                    : "Encryption not set up"}
                </span>
              </div>

              {/* Buttons container with proper spacing */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                {/* View Recovery Code Button */}
                {e2eeKeys?.encryptedRecoveryCode && (
                  <button
                    className="btn btn-secondary w-full"
                    onClick={() => setShowViewRecoveryCode(true)}
                    style={{ padding: "var(--space-md)" }}
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    View Recovery Code
                  </button>
                )}

                {/* Restore Encryption Button */}
                <button
                  className="btn btn-secondary w-full"
                  onClick={() => setShowRestoreEncryption(true)}
                  style={{
                    padding: "var(--space-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--space-sm)",
                  }}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Restore Encryption on This Device
                </button>
              </div>
            </div>

            {/* View Recovery Code Modal - Two-Step Verification */}
            {showViewRecoveryCode && !recoveryCodeToView && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 9999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px",
                  backgroundColor: "rgba(0, 0, 0, 0.8)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "420px",
                    backgroundColor: "var(--surface-primary)",
                    borderRadius: "16px",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                    overflow: "hidden",
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      padding: "24px 24px 0",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          marginBottom: "4px",
                        }}
                      >
                        {otpStep === "password" ? "Enter Your Password" : "Enter Verification Code"}
                      </h3>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "var(--text-muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        {otpStep === "password"
                          ? "First, verify your password. We'll then send a code to your email."
                          : `Enter the 6-digit code sent to ${user?.email}`}
                      </p>
                    </div>
                    <button
                      onClick={resetViewRecoveryModal}
                      style={{
                        padding: "8px",
                        marginLeft: "16px",
                        marginTop: "-4px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        borderRadius: "8px",
                      }}
                    >
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Step indicator */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "12px",
                      padding: "20px 24px",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: 600,
                        backgroundColor: otpStep === "password" ? "var(--accent-primary)" : "var(--success)",
                        color: "white",
                      }}
                    >
                      {otpStep === "password" ? "1" : "✓"}
                    </div>
                    <div
                      style={{
                        width: "48px",
                        height: "2px",
                        backgroundColor: otpStep === "otp" ? "var(--accent-primary)" : "var(--border-light)",
                        borderRadius: "1px",
                      }}
                    />
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: 600,
                        backgroundColor: otpStep === "otp" ? "var(--accent-primary)" : "var(--surface-elevated)",
                        color: otpStep === "otp" ? "white" : "var(--text-muted)",
                        border: otpStep === "otp" ? "none" : "2px solid var(--border-light)",
                      }}
                    >
                      2
                    </div>
                  </div>

                  {/* Form content */}
                  <div style={{ padding: "0 24px 24px" }}>
                    {otpStep === "password" ? (
                      <div style={{ marginBottom: "16px" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "14px",
                            fontWeight: 500,
                            color: "var(--text-primary)",
                            marginBottom: "8px",
                          }}
                        >
                          Your Password
                        </label>
                        <PasswordInput
                          className="input w-full"
                          placeholder="Enter your password"
                          value={encryptionPasswordInput}
                          onChange={(e) => setEncryptionPasswordInput(e.target.value)}
                          disabled={otpSending}
                        />
                      </div>
                    ) : (
                      <div style={{ marginBottom: "16px" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "14px",
                            fontWeight: 500,
                            color: "var(--text-primary)",
                            marginBottom: "8px",
                          }}
                        >
                          Verification Code
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          placeholder="000000"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          autoFocus
                          disabled={isVerifying}
                          style={{
                            width: "100%",
                            padding: "14px 16px",
                            fontSize: "24px",
                            fontFamily: "monospace",
                            fontWeight: 600,
                            textAlign: "center",
                            letterSpacing: "0.4em",
                            backgroundColor: "var(--surface-elevated)",
                            border: "1px solid var(--border-medium)",
                            borderRadius: "12px",
                            color: "var(--text-primary)",
                          }}
                        />
                        <p
                          style={{
                            fontSize: "13px",
                            color: "var(--text-muted)",
                            textAlign: "center",
                            marginTop: "12px",
                          }}
                        >
                          Didn&apos;t receive the code?{" "}
                          <button
                            onClick={() => {
                              setOtpStep("password");
                              setOtpCode("");
                              setOtpError("");
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--accent-primary)",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            Try again
                          </button>
                        </p>
                      </div>
                    )}

                    {encryptionError && (
                      <div style={{ marginBottom: "16px" }}>
                        <Alert variant="destructive" icon={<AlertCircleIcon />}>
                          <AlertTitle>{encryptionError}</AlertTitle>
                        </Alert>
                      </div>
                    )}

                    {otpError && (
                      <div style={{ marginBottom: "16px" }}>
                        <Alert variant="destructive" icon={<AlertCircleIcon />}>
                          <AlertTitle>{otpError}</AlertTitle>
                        </Alert>
                      </div>
                    )}
                  </div>

                  {/* Footer with buttons */}
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      padding: "16px 24px 24px",
                      borderTop: "1px solid var(--border-light)",
                    }}
                  >
                    <button
                      onClick={resetViewRecoveryModal}
                      disabled={otpSending || isVerifying}
                      style={{
                        flex: 1,
                        padding: "14px 20px",
                        fontSize: "15px",
                        fontWeight: 500,
                        backgroundColor: "transparent",
                        border: "1px solid var(--border-medium)",
                        borderRadius: "10px",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleViewRecoveryCode}
                      disabled={
                        otpSending ||
                        isVerifying ||
                        (otpStep === "password" && !encryptionPasswordInput) ||
                        (otpStep === "otp" && otpCode.length !== 6)
                      }
                      style={{
                        flex: 1,
                        padding: "14px 20px",
                        fontSize: "15px",
                        fontWeight: 600,
                        backgroundColor: "var(--accent-primary)",
                        border: "none",
                        borderRadius: "10px",
                        color: "white",
                        cursor: "pointer",
                        opacity:
                          otpSending ||
                          isVerifying ||
                          (otpStep === "password" && !encryptionPasswordInput) ||
                          (otpStep === "otp" && otpCode.length !== 6)
                            ? 0.5
                            : 1,
                      }}
                    >
                      {otpSending
                        ? "Sending..."
                        : isVerifying
                        ? "Verifying..."
                        : otpStep === "password"
                        ? "Send Code"
                        : "Verify & View"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* View Recovery Code Display */}
            {recoveryCodeToView && (
              <ViewRecoveryCode
                recoveryCode={recoveryCodeToView}
                onClose={() => {
                  setRecoveryCodeToView(null);
                  setShowViewRecoveryCode(false);
                }}
              />
            )}

            {/* Restore Encryption Modal */}
            {showRestoreEncryption && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 9999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px",
                  backgroundColor: "rgba(0, 0, 0, 0.8)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "420px",
                    backgroundColor: "var(--surface-primary)",
                    borderRadius: "16px",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                    overflow: "hidden",
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      padding: "24px 24px 16px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          marginBottom: "4px",
                        }}
                      >
                        Restore Encryption
                      </h3>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "var(--text-muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        Enter your recovery code and password to restore access to your encrypted content.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowRestoreEncryption(false);
                        setRestoreError("");
                        setRestorePasswordInput("");
                      }}
                      style={{
                        padding: "8px",
                        marginLeft: "16px",
                        marginTop: "-4px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        borderRadius: "8px",
                      }}
                    >
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Form content */}
                  <div style={{ padding: "8px 24px 24px" }}>
                    {/* Recovery Code Input */}
                    <div style={{ marginBottom: "20px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          marginBottom: "8px",
                        }}
                      >
                        Recovery Code
                      </label>
                      <textarea
                        placeholder="word1 word2 word3 word4 word5 word6"
                        rows={2}
                        id="restore-recovery-code"
                        disabled={restoreLoading}
                        style={{
                          width: "100%",
                          padding: "14px 16px",
                          fontSize: "15px",
                          fontFamily: "monospace",
                          textAlign: "center",
                          backgroundColor: "var(--surface-elevated)",
                          border: `1px solid ${restoreError ? "var(--error)" : "var(--border-medium)"}`,
                          borderRadius: "12px",
                          color: "var(--text-primary)",
                          resize: "none",
                        }}
                      />
                      <p
                        style={{
                          fontSize: "13px",
                          color: "var(--text-muted)",
                          marginTop: "6px",
                        }}
                      >
                        Enter all 6 words separated by spaces
                      </p>
                    </div>

                    {/* Password Input */}
                    <div style={{ marginBottom: "20px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          marginBottom: "8px",
                        }}
                      >
                        Current Password
                      </label>
                      <PasswordInput
                        className="input w-full"
                        placeholder="Enter your password"
                        value={restorePasswordInput}
                        onChange={(e) => setRestorePasswordInput(e.target.value)}
                        disabled={restoreLoading}
                      />
                    </div>

                    {restoreError && (
                      <div style={{ marginBottom: "16px" }}>
                        <Alert variant="destructive" icon={<AlertCircleIcon />}>
                          <AlertTitle>{restoreError}</AlertTitle>
                        </Alert>
                      </div>
                    )}
                  </div>

                  {/* Footer with buttons */}
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      padding: "16px 24px 24px",
                      borderTop: "1px solid var(--border-light)",
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowRestoreEncryption(false);
                        setRestoreError("");
                        setRestorePasswordInput("");
                      }}
                      disabled={restoreLoading}
                      style={{
                        flex: 1,
                        padding: "14px 20px",
                        fontSize: "15px",
                        fontWeight: 500,
                        backgroundColor: "transparent",
                        border: "1px solid var(--border-medium)",
                        borderRadius: "10px",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!restorePasswordInput || restoreLoading}
                      onClick={async () => {
                        const codeInput = document.getElementById("restore-recovery-code") as HTMLTextAreaElement;
                        const code = codeInput?.value?.trim();

                        if (!code) {
                          setRestoreError("Please enter your recovery code");
                          return;
                        }

                        if (!e2eeKeys || !user) {
                          setRestoreError("Encryption keys not found. Please try again later.");
                          return;
                        }

                        setRestoreLoading(true);
                        setRestoreError("");

                        try {
                          const updatedKeys = await restoreWithRecovery(
                            e2eeKeys,
                            code.toLowerCase(),
                            restorePasswordInput,
                            user.id
                          );

                          const res = await fetch("/api/users/e2ee-keys", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              wrappedDekPassword: updatedKeys.wrappedDekPassword,
                              passwordKdfSalt: updatedKeys.passwordKdfSalt,
                              wrappedDekRecovery: updatedKeys.wrappedDekRecovery,
                              recoveryKdfSalt: updatedKeys.recoveryKdfSalt,
                              encryptedRecoveryCode: updatedKeys.encryptedRecoveryCode,
                              migrationState: updatedKeys.migrationState,
                            }),
                          });

                          if (!res.ok) {
                            throw new Error("Failed to save restored encryption keys");
                          }

                          setE2eeKeys({
                            userId: user.id,
                            version: e2eeKeys.version,
                            wrappedDekPassword: updatedKeys.wrappedDekPassword,
                            passwordKdfSalt: updatedKeys.passwordKdfSalt,
                            wrappedDekRecovery: updatedKeys.wrappedDekRecovery,
                            recoveryKdfSalt: updatedKeys.recoveryKdfSalt,
                            encryptedRecoveryCode: updatedKeys.encryptedRecoveryCode,
                            migrationState: updatedKeys.migrationState as "legacy" | "migrating" | "upgraded",
                          });

                          setShowRestoreEncryption(false);
                          setRestorePasswordInput("");
                          showToast("Encryption restored successfully!", "success");
                        } catch (error) {
                          console.error("Restore error:", error);
                          setRestoreError(
                            error instanceof Error
                              ? error.message
                              : "Invalid recovery code or password. Please try again."
                          );
                        } finally {
                          setRestoreLoading(false);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: "14px 20px",
                        fontSize: "15px",
                        fontWeight: 600,
                        backgroundColor: "var(--accent-primary)",
                        border: "none",
                        borderRadius: "10px",
                        color: "white",
                        cursor: "pointer",
                        opacity: !restorePasswordInput || restoreLoading ? 0.5 : 1,
                      }}
                    >
                      {restoreLoading ? "Restoring..." : "Restore Encryption"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Recovery Info Modal */}
            {showRecoveryInfoModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 9999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px",
                  backgroundColor: "rgba(0, 0, 0, 0.8)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "480px",
                    maxHeight: "85vh",
                    backgroundColor: "var(--surface-primary)",
                    borderRadius: "16px",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      padding: "24px 24px 16px",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          marginBottom: "4px",
                        }}
                      >
                        About Recovery Codes
                      </h3>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "var(--text-muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        Important information about your encryption
                      </p>
                    </div>
                    <button
                      onClick={() => setShowRecoveryInfoModal(false)}
                      style={{
                        padding: "8px",
                        marginLeft: "16px",
                        marginTop: "-4px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        borderRadius: "8px",
                      }}
                    >
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Scrollable Content */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      padding: "8px 24px 24px",
                    }}
                  >
                    {/* What is a Recovery Code */}
                    <div
                      style={{
                        padding: "16px",
                        backgroundColor: "var(--surface-elevated)",
                        borderRadius: "12px",
                        marginBottom: "12px",
                      }}
                    >
                      <h4
                        style={{
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          marginBottom: "8px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>🔑</span> What is a Recovery Code?
                      </h4>
                      <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        Your recovery code is a set of 6 words that acts as a backup key to your encrypted data.
                        Think of it like a spare key to your house — if you lose your main key (password),
                        you can use this to get back in.
                      </p>
                    </div>

                    {/* Why is it Important */}
                    <div
                      style={{
                        padding: "16px",
                        backgroundColor: "var(--surface-elevated)",
                        borderRadius: "12px",
                        marginBottom: "12px",
                      }}
                    >
                      <h4
                        style={{
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          marginBottom: "8px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>⚠️</span> Why is it Important?
                      </h4>
                      <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "8px" }}>
                        Your encrypted content includes <strong>private messages, prayers, and personal notes</strong> — all protected so only you can read them. Not even we can access them.
                      </p>
                      <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        If you forget your password and need to reset it, <strong style={{ color: "var(--error)" }}>your recovery code is the ONLY way</strong> to restore access. Without it, your encrypted data would be permanently lost.
                      </p>
                    </div>

                    {/* How to Keep it Safe */}
                    <div
                      style={{
                        padding: "16px",
                        backgroundColor: "var(--surface-elevated)",
                        borderRadius: "12px",
                        marginBottom: "12px",
                      }}
                    >
                      <h4
                        style={{
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          marginBottom: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>🔒</span> How to Keep it Safe
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "14px", color: "var(--text-secondary)" }}>
                          <span style={{ color: "var(--success)", fontWeight: 700, flexShrink: 0 }}>✓</span>
                          <span>Write it down and store it somewhere safe</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "14px", color: "var(--text-secondary)" }}>
                          <span style={{ color: "var(--success)", fontWeight: 700, flexShrink: 0 }}>✓</span>
                          <span>Save it in a password manager</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "14px", color: "var(--text-secondary)" }}>
                          <span style={{ color: "var(--error)", fontWeight: 700, flexShrink: 0 }}>✗</span>
                          <span>Never share it with anyone</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "14px", color: "var(--text-secondary)" }}>
                          <span style={{ color: "var(--error)", fontWeight: 700, flexShrink: 0 }}>✗</span>
                          <span>Don&apos;t store it in an easily accessible place on your device</span>
                        </div>
                      </div>
                    </div>

                    {/* Viewing Your Recovery Code */}
                    <div
                      style={{
                        padding: "16px",
                        backgroundColor: "rgba(184, 134, 11, 0.1)",
                        border: "1px solid rgba(184, 134, 11, 0.25)",
                        borderRadius: "12px",
                      }}
                    >
                      <h4
                        style={{
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          marginBottom: "8px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>👁️</span> Viewing Your Recovery Code
                      </h4>
                      <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        For security, viewing your recovery code requires two-step verification:
                      </p>
                      <ol style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "8px", paddingLeft: "20px", lineHeight: 1.8 }}>
                        <li>Enter your password</li>
                        <li>Enter a 6-digit code sent to your email</li>
                      </ol>
                      <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "8px" }}>
                        This ensures that even if someone knows your password, they can&apos;t access your recovery code without access to your email.
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      padding: "16px 24px 24px",
                      borderTop: "1px solid var(--border-light)",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      onClick={() => setShowRecoveryInfoModal(false)}
                      style={{
                        width: "100%",
                        padding: "14px 20px",
                        fontSize: "15px",
                        fontWeight: 600,
                        backgroundColor: "var(--accent-primary)",
                        border: "none",
                        borderRadius: "10px",
                        color: "white",
                        cursor: "pointer",
                      }}
                    >
                      Got it
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Invite Friends Section */}
            <div className="card" style={{ marginBottom: "var(--space-lg)", padding: "var(--space-lg)" }}>
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: "var(--space-lg)" }}
              >
                <h2
                  className="font-serif font-semibold text-[var(--text-primary)]"
                  style={{ fontSize: "var(--text-lg)" }}
                >
                  Invite Friends
                </h2>
              </div>

              <p
                className="text-[var(--text-secondary)]"
                style={{
                  fontSize: "var(--text-sm)",
                  marginBottom: "var(--space-lg)",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                Invite friends and family to join Love1Another and pray together.
                Share a personal invitation link or send an email invite.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                {/* Copy Link Button */}
                <button
                  className="btn btn-secondary w-full"
                  onClick={handleCopyShareLink}
                  style={{
                    padding: "var(--space-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--space-sm)",
                  }}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {shareLinkCopied ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    )}
                  </svg>
                  {shareLinkCopied ? "Copied!" : "Copy Invite Link"}
                </button>

                {/* Send Email Invite Button */}
                <button
                  className="btn btn-primary w-full"
                  onClick={() => setShowShareModal(true)}
                  style={{
                    padding: "var(--space-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--space-sm)",
                  }}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  Send Email Invitation
                </button>
              </div>
            </div>

            {/* Share/Invite Modal */}
            {showShareModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 9999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px",
                  backgroundColor: "rgba(0, 0, 0, 0.8)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "420px",
                    backgroundColor: "var(--surface-primary)",
                    borderRadius: "16px",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                    overflow: "hidden",
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      padding: "24px 24px 16px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          marginBottom: "4px",
                        }}
                      >
                        Invite a Friend
                      </h3>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "var(--text-muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        Send a personal invitation to join Love1Another and connect with you.
                      </p>
                    </div>
                    <button
                      onClick={resetShareModal}
                      style={{
                        padding: "8px",
                        marginLeft: "16px",
                        marginTop: "-4px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        borderRadius: "8px",
                      }}
                    >
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Form content */}
                  <div style={{ padding: "8px 24px 24px" }}>
                    {shareSuccess ? (
                      <div style={{ textAlign: "center", padding: "24px 0" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "64px",
                            height: "64px",
                            borderRadius: "50%",
                            backgroundColor: "var(--success-light)",
                            marginBottom: "16px",
                          }}
                        >
                          <svg width="32" height="32" fill="var(--success)" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        </div>
                        <h4
                          style={{
                            fontSize: "18px",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            marginBottom: "8px",
                          }}
                        >
                          Invitation Sent!
                        </h4>
                        <p
                          style={{
                            fontSize: "14px",
                            color: "var(--text-secondary)",
                            lineHeight: 1.6,
                          }}
                        >
                          Your friend will receive an email with your personal invitation.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div style={{ marginBottom: "20px" }}>
                          <label
                            style={{
                              display: "block",
                              fontSize: "14px",
                              fontWeight: 500,
                              color: "var(--text-primary)",
                              marginBottom: "8px",
                            }}
                          >
                            Friend&apos;s Email Address
                          </label>
                          <input
                            type="email"
                            placeholder="friend@example.com"
                            value={shareEmail}
                            onChange={(e) => setShareEmail(e.target.value)}
                            disabled={shareSending}
                            style={{
                              width: "100%",
                              padding: "14px 16px",
                              fontSize: "15px",
                              backgroundColor: "var(--surface-elevated)",
                              border: "1px solid var(--border-medium)",
                              borderRadius: "12px",
                              color: "var(--text-primary)",
                            }}
                          />
                        </div>

                        {/* Preview */}
                        <div
                          style={{
                            padding: "16px",
                            backgroundColor: "var(--surface-elevated)",
                            borderRadius: "12px",
                          }}
                        >
                          <p
                            style={{
                              fontSize: "14px",
                              fontStyle: "italic",
                              color: "var(--text-secondary)",
                              lineHeight: 1.6,
                            }}
                          >
                            &quot;Hey! Can I pray for you? Sign up on Love1Another and add me: <strong style={{ color: "var(--accent-primary)" }}>@{user?.username || "username"}</strong>&quot;
                          </p>
                          <p
                            style={{
                              fontSize: "13px",
                              color: "var(--text-muted)",
                              marginTop: "8px",
                            }}
                          >
                            — {user?.fullName || "Your Name"}
                          </p>
                        </div>

                        {shareError && (
                          <div style={{ marginTop: "16px" }}>
                            <Alert variant="destructive" icon={<AlertCircleIcon />}>
                              <AlertTitle>{shareError}</AlertTitle>
                            </Alert>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Footer with buttons */}
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      padding: "16px 24px 24px",
                      borderTop: "1px solid var(--border-light)",
                    }}
                  >
                    <button
                      onClick={resetShareModal}
                      disabled={shareSending}
                      style={{
                        flex: 1,
                        padding: "14px 20px",
                        fontSize: "15px",
                        fontWeight: 500,
                        backgroundColor: "transparent",
                        border: "1px solid var(--border-medium)",
                        borderRadius: "10px",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                      }}
                    >
                      {shareSuccess ? "Close" : "Cancel"}
                    </button>
                    {!shareSuccess && (
                      <button
                        onClick={handleShareInvite}
                        disabled={!shareEmail || shareSending}
                        style={{
                          flex: 1,
                          padding: "14px 20px",
                          fontSize: "15px",
                          fontWeight: 600,
                          backgroundColor: "var(--accent-primary)",
                          border: "none",
                          borderRadius: "10px",
                          color: "white",
                          cursor: "pointer",
                          opacity: !shareEmail || shareSending ? 0.5 : 1,
                        }}
                      >
                        {shareSending ? "Sending..." : "Send Invitation"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

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
            <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
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

            {/* PWA Instructions */}
            <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
              <h2
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                }}
              >
                Add to Home Screen
              </h2>
              <p
                className="text-[var(--text-secondary)]"
                style={{
                  fontSize: "var(--text-sm)",
                  marginBottom: "var(--space-lg)",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                Add Love1Another to your device for quick access. On mobile, you can
                save it as a web app that works just like a native app. On desktop,
                bookmark the page for easy access.
              </p>
              <PWAInstructions />
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
