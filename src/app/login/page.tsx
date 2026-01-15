"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useCrypto } from "@/lib/use-crypto";
import {
  Alert,
  AlertTitle,
  CheckCircleIcon,
  AlertCircleIcon,
} from "@/components/ui/alert";
import { PasswordInput } from "@/components/PasswordInput";

type AuthMode = "login" | "signup" | "verify-otp" | "forgot-password" | "reset-password";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [pendingKeys, setPendingKeys] = useState<{
    publicKey: string;
    encryptedPrivateKey: string;
    keySalt: string;
  } | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [resetEmail, setResetEmail] = useState(""); // Email for password reset
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetCode, setResetCode] = useState(""); // OTP code for password reset
  const [resendCooldown, setResendCooldown] = useState(0); // Cooldown timer for resend

  // Ref to track if password reset is in progress (prevents auth state change interference)
  const isResettingPasswordRef = useRef(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { generateKeys, unlock, cryptoSupported, missingFeatures } =
    useCrypto();

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Check for error, success, or mode in URL params
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError("Authentication failed. Please try again.");
      window.history.replaceState({}, "", "/login");
    }

    // Check for success message (e.g., after password reset)
    const successParam = searchParams.get("success");
    if (successParam === "password_updated") {
      setSuccess("Password updated successfully! Please sign in with your new password.");
      window.history.replaceState({}, "", "/login");
    }

    // Check if this is a password reset flow
    const modeParam = searchParams.get("mode");
    if (modeParam === "reset-password") {
      setMode("reset-password");
      // Pre-fill email if provided
      const emailParam = searchParams.get("email");
      if (emailParam) {
        setResetEmail(decodeURIComponent(emailParam));
      }
      window.history.replaceState({}, "", "/login?mode=reset-password");
    }
  }, [searchParams]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 6) {
      return "Password must be at least 6 characters";
    }
    if (!/[A-Z]/.test(pwd)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(pwd)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(pwd)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      return "Password must contain at least one symbol (!@#$%^&*...)";
    }
    return null;
  };

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

  // Check username availability with debounce
  useEffect(() => {
    if (mode !== "signup" || !username) {
      setUsernameAvailable(null);
      setUsernameError("");
      return;
    }

    const normalizedUsername = username.toLowerCase().trim();
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
  }, [username, mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      let loginEmail = email.trim();

      // Check if input is a username (not an email)
      if (!loginEmail.includes("@")) {
        // Remove @ prefix if user typed it
        const usernameToLookup = loginEmail.startsWith("@")
          ? loginEmail.slice(1).toLowerCase()
          : loginEmail.toLowerCase();

        // Look up email from username
        const lookupRes = await fetch(
          `/api/users/lookup-by-username?username=${encodeURIComponent(
            usernameToLookup
          )}`
        );
        if (lookupRes.ok) {
          const lookupData = await lookupRes.json();
          if (lookupData.email) {
            loginEmail = lookupData.email;
          } else {
            setError("Username not found");
            setIsLoading(false);
            return;
          }
        } else {
          setError("Username not found");
          setIsLoading(false);
          return;
        }
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: loginEmail,
          password,
        }
      );

      if (authError) {
        if (authError.message.includes("Email not confirmed")) {
          // User hasn't verified email yet - resend OTP
          setPendingEmail(email.trim());
          setPendingPassword(password);
          setMode("verify-otp");

          await supabase.auth.resend({
            type: "signup",
            email: email.trim(),
          });

          setSuccess("Please check your email for the verification code.");
        } else {
          setError(authError.message);
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Store remember me preference
        if (typeof window !== "undefined") {
          if (rememberMe) {
            localStorage.setItem("rememberMe", "true");
          } else {
            localStorage.removeItem("rememberMe");
            // Set a session flag that will be cleared when browser closes
            sessionStorage.setItem("sessionActive", "true");
          }
        }

        // Unlock encryption keys
        const userKeys = await fetchUserKeys(data.user.id);
        if (userKeys) {
          try {
            await unlock(userKeys, password, data.user.id);
          } catch (unlockError) {
            // If unlock fails (e.g., after password reset), user will need to restore via recovery code
            // This is expected when the password has changed - they can restore in Settings
            console.warn("Could not unlock encryption keys:", unlockError);
            // Continue to app - user can restore encrypted history in Settings > Encryption & Recovery
          }
        }

        // Redirect to home
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Check crypto support
    if (!cryptoSupported) {
      setError(
        `Your browser doesn't support encryption: ${missingFeatures.join(", ")}`
      );
      return;
    }

    // Validate all fields
    if (!displayName.trim()) {
      setError("Please enter your name");
      return;
    }

    // Validate username
    const normalizedUsername = username.toLowerCase().trim();
    const usernameValidationError = validateUsername(normalizedUsername);
    if (usernameValidationError) {
      setError(usernameValidationError);
      return;
    }

    if (!usernameAvailable) {
      setError("Please choose an available username");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      // Generate E2E encryption keys first
      const userKeys = await generateKeys(password);

      // Sign up with Supabase
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: displayName.trim(),
            username: normalizedUsername,
            avatar_initials: getInitials(displayName.trim()),
            avatar_color: getRandomColor(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        // Provide more helpful error messages
        let errorMessage = authError.message;
        if (authError.message.includes("already registered")) {
          errorMessage = "This email is already registered. Try logging in instead.";
        } else if (authError.message.includes("email")) {
          errorMessage = "Error sending confirmation email. Please try again or contact support.";
        }
        setError(errorMessage);
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Check if email confirmation is required
        if (data.session) {
          // Email confirmation disabled - user is logged in immediately
          // Store encryption keys in Supabase (we have a session)
          const { error: keysError } = await supabase.from("user_keys").insert({
            user_id: data.user.id,
            public_key: userKeys.publicKey,
            encrypted_private_key: userKeys.encryptedPrivateKey,
            key_salt: userKeys.keySalt,
          });

          if (keysError) {
            console.error("Error storing encryption keys:", keysError);
          }

          await unlock(userKeys, password, data.user.id);

          // Wait for session to be fully established before navigating
          await new Promise(resolve => setTimeout(resolve, 300));
          window.location.href = "/";
        } else {
          // Email confirmation required - store keys in state for later
          setPendingEmail(email.trim());
          setPendingPassword(password);
          setPendingKeys({
            publicKey: userKeys.publicKey,
            encryptedPrivateKey: userKeys.encryptedPrivateKey,
            keySalt: userKeys.keySalt,
          });
          setMode("verify-otp");
          setSuccess("Check your email for the verification code!");
        }
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: otpCode.trim(),
        type: "signup",
      });

      if (verifyError) {
        setError(verifyError.message);
        setIsLoading(false);
        return;
      }

      if (data.user && data.session) {
        // Store encryption keys in Supabase (now we have a session)
        if (pendingKeys) {
          const { error: keysError } = await supabase.from("user_keys").insert({
            user_id: data.user.id,
            public_key: pendingKeys.publicKey,
            encrypted_private_key: pendingKeys.encryptedPrivateKey,
            key_salt: pendingKeys.keySalt,
          });

          if (keysError) {
            console.error("Error storing encryption keys after OTP:", keysError);
          }

          // Unlock encryption keys with the pending keys
          if (pendingPassword) {
            await unlock(pendingKeys, pendingPassword, data.user.id);
          }
        } else {
          // Fallback: try to fetch existing keys (for re-verification)
          const userKeys = await fetchUserKeys(data.user.id);
          if (userKeys && pendingPassword) {
            await unlock(userKeys, pendingPassword, data.user.id);
          }
        }

        // Create default "Me" profile for new user
        try {
          const fullName = data.user.user_metadata?.full_name || "Me";
          const initials =
            fullName
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2) || "ME";

          await fetch("/api/people", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              displayName: "Me",
              type: "person",
              avatarInitials: initials,
              avatarColor: "#7c9bb8", // Default blue color
            }),
          });
        } catch (profileError) {
          // Don't block signup if profile creation fails
          console.error("Error creating default profile:", profileError);
        }

        // Show redirecting overlay
        setIsRedirecting(true);
        setIsLoading(true);

        // Wait for session to be fully established before navigating
        // This prevents race conditions with AuthGuard
        await new Promise(resolve => setTimeout(resolve, 500));

        // Force a full page reload to ensure AuthGuard picks up the new session
        window.location.href = "/";
      }
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("Verification failed. Please try again.");
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError("");
    setIsLoading(true);

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
      });

      if (resendError) {
        setError(resendError.message);
      } else {
        setSuccess("Verification code resent! Check your email.");
      }
    } catch (err) {
      console.error("Resend OTP error:", err);
      setError("Failed to resend code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    if (!resetEmail.trim() || !resetEmail.includes("@")) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    try {
      // Send reset email without redirect - user will enter the OTP code manually
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        resetEmail.trim()
      );

      if (resetError) {
        // Don't reveal if email exists for security
        console.error("Password reset error:", resetError);
      }

      // Always show success to prevent email enumeration
      setSuccess("If an account exists with this email, you'll receive a reset code shortly.");
      setResendCooldown(60); // 60 second cooldown

      // Auto-transition to reset-password mode after brief delay
      setTimeout(() => {
        setMode("reset-password");
        setSuccess("");
      }, 2000);
    } catch (err) {
      console.error("Password reset error:", err);
      setError("Failed to send reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    if (resendCooldown > 0) return;

    setError("");
    setIsLoading(true);

    try {
      const emailToUse = resetEmail.trim();
      if (!emailToUse || !emailToUse.includes("@")) {
        setError("Please enter your email address first");
        setIsLoading(false);
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailToUse);

      if (resetError) {
        console.error("Resend reset code error:", resetError);
      }

      // Always show success to prevent email enumeration
      setSuccess("If an account exists with this email, a new code has been sent.");
      setResendCooldown(60);
    } catch (err) {
      console.error("Resend reset code error:", err);
      setError("Failed to resend code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    // Validate email
    if (!resetEmail.trim() || !resetEmail.includes("@")) {
      setError("Please enter your email address");
      setIsLoading(false);
      return;
    }

    // Validate reset code
    if (!resetCode.trim()) {
      setError("Please enter the reset code from your email");
      setIsLoading(false);
      return;
    }

    // Validate passwords match
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    // Validate password strength
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      setIsLoading(false);
      return;
    }

    // Mark that we're in the password reset process to prevent auth state interference
    isResettingPasswordRef.current = true;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("passwordResetInProgress", "true");
    }

    try {
      // Step 1: Verify the OTP code - this establishes a recovery session
      const { error: verifyError, data: verifyData } = await supabase.auth.verifyOtp({
        email: resetEmail.trim(),
        token: resetCode.trim(),
        type: "recovery",
      });

      if (verifyError) {
        isResettingPasswordRef.current = false;
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("passwordResetInProgress");
        }
        // Provide user-friendly error messages
        if (verifyError.message.includes("expired") || verifyError.message.includes("invalid")) {
          setError("Reset code is invalid or expired. Please request a new one.");
        } else if (verifyError.message.includes("rate") || verifyError.message.includes("limit")) {
          setError("Too many attempts. Please wait a few minutes and try again.");
        } else {
          setError(verifyError.message);
        }
        setIsLoading(false);
        return;
      }

      if (!verifyData?.session) {
        isResettingPasswordRef.current = false;
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("passwordResetInProgress");
        }
        setError("Failed to verify reset code. Please try again.");
        setIsLoading(false);
        return;
      }

      // Small delay to let auth state settle before continuing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 2: Update the password (now we have a valid session)
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        isResettingPasswordRef.current = false;
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("passwordResetInProgress");
        }
        if (updateError.message.includes("same")) {
          setError("New password must be different from your previous password.");
        } else {
          setError(updateError.message);
        }
        setIsLoading(false);
        return;
      }

      // Step 3: Sign out for security - user must log in with new password
      // Clear the password reset flag BEFORE signOut to prevent auth state interference
      isResettingPasswordRef.current = false;
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("passwordResetInProgress");
        // Set a flag to prevent SIGNED_OUT handler from redirecting
        sessionStorage.setItem("passwordResetComplete", "true");
      }

      try {
        // Sign out and wait for it to complete
        await supabase.auth.signOut({ scope: "local" });
        // Clear ALL Supabase storage to prevent token refresh attempts
        if (typeof window !== "undefined") {
          // Clear Supabase auth storage keys
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));

          // Also clear sessionStorage Supabase keys
          const sessionKeysToRemove: string[] = [];
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
              sessionKeysToRemove.push(key);
            }
          }
          sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
        }
        // Wait a bit longer to ensure signOut completes fully
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch {
        // Non-critical error
      }

      setSuccess("Password updated successfully! Redirecting to login...");

      // Redirect to login page with success message
      // Use a small delay to ensure signOut is fully processed
      await new Promise(resolve => setTimeout(resolve, 500));
      // Clear all flags and loop detection counters before redirect
      if (typeof window !== "undefined") {
        // Clear password reset flag
        sessionStorage.removeItem("passwordResetComplete");
        // Clear loop detection counters to prevent circuit breaker on new page
        sessionStorage.removeItem("authLoopDetection");
        sessionStorage.removeItem("authLoopBreaker");
        sessionStorage.removeItem("authLoopBreaker_time");
        sessionStorage.removeItem("lastInitialSession");
      }
      window.location.href = "/login?success=password_updated";
    } catch (err) {
      isResettingPasswordRef.current = false;
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("passwordResetInProgress");
      }
      console.error("Password update error:", err);
      setError("Failed to update password. Please try again.");
      setIsLoading(false);
    }
  };

  // Helper to fetch user's encryption keys
  const fetchUserKeys = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_keys")
      .select("public_key, encrypted_private_key, key_salt")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      console.warn("Could not fetch user keys:", error);
      return null;
    }

    return {
      publicKey: data.public_key,
      encryptedPrivateKey: data.encrypted_private_key,
      keySalt: data.key_salt,
    };
  };

  const resetForm = () => {
    setPassword("");
    setConfirmPassword("");
    setDisplayName("");
    setOtpCode("");
    setError("");
    setSuccess("");
    setResetEmail("");
    setNewPassword("");
    setConfirmNewPassword("");
    setResetCode("");
  };

  const switchMode = (newMode: AuthMode) => {
    resetForm();
    setMode(newMode);
  };

  // Utility functions
  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getRandomColor = (): string => {
    const colors = [
      "#e07c7c",
      "#7cb87c",
      "#7c9bb8",
      "#b87cb8",
      "#b8a07c",
      "#7cb8b8",
      "#e0a07c",
      "#a07cb8",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Show redirecting overlay when logging in after OTP verification
  if (isRedirecting) {
    return (
      <div className="lock-screen">
        <div
          className="lock-card card card-elevated animate-fade-in"
          style={{ maxWidth: "400px", width: "100%", textAlign: "center" }}
        >
          <div
            className="mx-auto"
            style={{
              width: "80px",
              height: "80px",
              marginBottom: "var(--space-lg)",
              borderRadius: "20px",
              overflow: "hidden",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <img
              src="/favicon.jpeg"
              alt="Love1Another"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div style={{ marginBottom: "var(--space-md)" }}>
            <LoadingSpinner />
          </div>
          <h2
            className="font-serif font-semibold text-[var(--text-primary)]"
            style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-sm)" }}
          >
            Welcome!
          </h2>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: "var(--text-sm)" }}>
            Email verified. Logging you in...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="lock-screen">
      <div
        className="lock-card card card-elevated animate-fade-in"
        style={{ maxWidth: "400px", width: "100%" }}
      >
        {/* Logo */}
        <div
          className="mx-auto"
          style={{
            width: "80px",
            height: "80px",
            marginBottom: "var(--space-lg)",
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <img
            src="/favicon.jpeg"
            alt="Love1Another"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        {/* Title */}
        <h1
          className="font-serif font-bold text-[var(--text-primary)]"
          style={{
            fontSize: "var(--text-2xl)",
            marginBottom: "var(--space-xs)",
          }}
        >
          Love1Another
        </h1>

        <p
          className="text-[var(--text-muted)]"
          style={{
            marginBottom: "var(--space-xl)",
            fontSize: "var(--text-sm)",
          }}
        >
          {mode === "login" && "Sign in to continue"}
          {mode === "signup" && "Create your account"}
          {mode === "verify-otp" && "Verify your email"}
          {mode === "forgot-password" && "Reset your password"}
          {mode === "reset-password" && "Create new password"}
        </p>

        {/* Mode Toggle (only for login/signup) */}
        {(mode === "login" || mode === "signup") && (
          <div
            className="flex"
            style={{
              marginBottom: "var(--space-lg)",
              background: "var(--surface-secondary)",
              borderRadius: "var(--card-radius-sm)",
              padding: "4px",
            }}
          >
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="flex-1 font-medium transition-all"
              style={{
                padding: "var(--space-sm) var(--space-md)",
                borderRadius: "calc(var(--card-radius-sm) - 2px)",
                background:
                  mode === "login" ? "var(--surface-primary)" : "transparent",
                color:
                  mode === "login"
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
                boxShadow: mode === "login" ? "var(--shadow-sm)" : "none",
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="flex-1 font-medium transition-all"
              style={{
                padding: "var(--space-sm) var(--space-md)",
                borderRadius: "calc(var(--card-radius-sm) - 2px)",
                background:
                  mode === "signup" ? "var(--surface-primary)" : "transparent",
                color:
                  mode === "signup"
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
                boxShadow: mode === "signup" ? "var(--shadow-sm)" : "none",
              }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div
            className="animate-fade-in"
            style={{ marginBottom: "var(--space-md)" }}
          >
            <Alert variant="success" icon={<CheckCircleIcon />}>
              <AlertTitle>{success}</AlertTitle>
            </Alert>
          </div>
        )}

        {/* Login Form */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="animate-fade-in">
            <div className="form-group">
              <label className="label" htmlFor="email">
                Email or Username
              </label>
              <input
                id="email"
                type="text"
                className={`input ${error ? "input-error" : ""}`}
                placeholder="your@email.com or @username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label className="label" htmlFor="password">
                Password
              </label>
              <PasswordInput
                id="password"
                className={`input ${error ? "input-error" : ""}`}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: "var(--space-md)" }}
            >
              <label
                className="flex items-center cursor-pointer"
                style={{ gap: "var(--space-xs)" }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    width: "16px",
                    height: "16px",
                    accentColor: "#3b82f6",
                    cursor: "pointer",
                  }}
                />
                <span
                  className="text-[var(--text-muted)]"
                  style={{ fontSize: "var(--text-sm)" }}
                >
                  Remember me
                </span>
              </label>

              <button
                type="button"
                onClick={() => switchMode("forgot-password")}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                style={{
                  fontSize: "var(--text-sm)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div
                className="animate-shake"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <Alert variant="destructive" icon={<AlertCircleIcon />}>
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={isLoading || !email || !password}
              style={{ background: "#3b82f6" }}
            >
              {isLoading ? (
                <span
                  className="flex items-center justify-center"
                  style={{ gap: "var(--space-sm)" }}
                >
                  <LoadingSpinner />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        )}

        {/* Signup Form */}
        {mode === "signup" && (
          <form onSubmit={handleSignup} className="animate-fade-in">
            <div className="form-group">
              <label className="label" htmlFor="displayName">
                Full Name
              </label>
              <input
                id="displayName"
                type="text"
                className="input"
                placeholder="Your full name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>

            <div className="form-group">
              <label className="label" htmlFor="username">
                Username
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="username"
                  type="text"
                  className="input"
                  placeholder="your_username"
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                    )
                  }
                  autoComplete="username"
                  required
                  style={{
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
                    }}
                  >
                    <LoadingSpinner />
                  </div>
                )}
                {!isCheckingUsername && usernameAvailable === true && (
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
                  username.length >= 5 && (
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
              {usernameError && (
                <p
                  className="form-error"
                  style={{ marginTop: "var(--space-xs)" }}
                >
                  {usernameError}
                </p>
              )}
              {!usernameError && (
                <p className="form-hint">
                  Min 5 chars: lowercase letters, numbers, and underscores only
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="label" htmlFor="signupEmail">
                Email
              </label>
              <input
                id="signupEmail"
                type="email"
                className="input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label className="label" htmlFor="newPassword">
                Password
              </label>
              <PasswordInput
                id="newPassword"
                className="input"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <p className="form-hint">
                Min 6 chars: uppercase, lowercase, number, and symbol
              </p>
            </div>

            <div className="form-group">
              <label className="label" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <PasswordInput
                id="confirmPassword"
                className="input"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <div
                className="animate-shake"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <Alert variant="destructive" icon={<AlertCircleIcon />}>
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={
                isLoading ||
                !displayName ||
                !username ||
                !usernameAvailable ||
                isCheckingUsername ||
                !email ||
                !password ||
                !confirmPassword
              }
              style={{ background: "#3b82f6" }}
            >
              {isLoading ? (
                <span
                  className="flex items-center justify-center"
                  style={{ gap: "var(--space-sm)" }}
                >
                  <LoadingSpinner />
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        )}

        {/* OTP Verification Form */}
        {mode === "verify-otp" && (
          <form onSubmit={handleVerifyOTP} className="animate-fade-in">
            <p
              className="text-[var(--text-secondary)]"
              style={{
                marginBottom: "var(--space-lg)",
                textAlign: "center",
                fontSize: "var(--text-sm)",
              }}
            >
              We sent a 6-digit code to <strong>{pendingEmail}</strong>
            </p>

            <div className="form-group">
              <label
                className="label"
                htmlFor="otpCode"
                style={{ textAlign: "center" }}
              >
                Verification Code
              </label>
              <input
                id="otpCode"
                type="text"
                className={`input ${error ? "input-error" : ""}`}
                placeholder="000000"
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                style={{
                  textAlign: "center",
                  letterSpacing: "0.3em",
                  fontSize: "var(--text-lg)",
                  fontWeight: 600,
                  padding: "var(--space-md)",
                }}
                required
              />
            </div>

            {error && (
              <div
                className="animate-shake"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <Alert variant="destructive" icon={<AlertCircleIcon />}>
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={isLoading || otpCode.length !== 6}
              style={{ background: "#3b82f6", marginBottom: "var(--space-md)" }}
            >
              {isLoading ? (
                <span
                  className="flex items-center justify-center"
                  style={{ gap: "var(--space-sm)" }}
                >
                  <LoadingSpinner />
                  Verifying...
                </span>
              ) : (
                "Verify Email"
              )}
            </button>

            <div
              className="flex justify-center"
              style={{ gap: "var(--space-md)" }}
            >
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={isLoading}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                style={{
                  fontSize: "var(--text-sm)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Resend code
              </button>
              <span className="text-[var(--text-muted)]">•</span>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                style={{
                  fontSize: "var(--text-sm)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Back to login
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password Form - Request Reset Code */}
        {mode === "forgot-password" && (
          <form onSubmit={handleForgotPassword} className="animate-fade-in">
            <p
              className="text-[var(--text-secondary)]"
              style={{
                marginBottom: "var(--space-lg)",
                textAlign: "center",
                fontSize: "var(--text-sm)",
              }}
            >
              Enter your email and we&apos;ll send you a reset code.
            </p>

            {/* Recovery code warning */}
            <div
              className="flex items-start gap-3 p-3 rounded-lg mb-4"
              style={{
                backgroundColor: "rgba(245, 158, 11, 0.1)",
                border: "1px solid var(--warning)",
              }}
            >
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                style={{ color: "var(--warning)" }}
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
              <p
                className="text-sm"
                style={{ color: "var(--warning)" }}
              >
                If you have encrypted messages, you will need your <strong>Recovery Code</strong> after resetting your password.
              </p>
            </div>

            <div className="form-group">
              <label className="label" htmlFor="resetEmail">
                Email Address
              </label>
              <input
                id="resetEmail"
                name="reset-email-field"
                type="email"
                className={`input ${error ? "input-error" : ""}`}
                placeholder="Enter your email address"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {error && (
              <div
                className="animate-shake"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <Alert variant="destructive" icon={<AlertCircleIcon />}>
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              </div>
            )}

            {success && (
              <div
                className="animate-fade-in"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <Alert variant="success" icon={<CheckCircleIcon />}>
                  <AlertTitle>{success}</AlertTitle>
                </Alert>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={isLoading || !resetEmail}
              style={{ background: "#3b82f6", marginBottom: "var(--space-md)" }}
            >
              {isLoading ? (
                <span
                  className="flex items-center justify-center"
                  style={{ gap: "var(--space-sm)" }}
                >
                  <LoadingSpinner />
                  Sending...
                </span>
              ) : (
                "Send Reset Code"
              )}
            </button>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "var(--space-md)",
                marginTop: "var(--space-sm)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (resetEmail.trim()) {
                    setMode("reset-password");
                  } else {
                    setError("Please enter your email first");
                  }
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                style={{
                  fontSize: "var(--text-sm)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Already have a code?
              </button>
              <span className="text-[var(--text-muted)]">•</span>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                style={{
                  fontSize: "var(--text-sm)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Back to login
              </button>
            </div>
          </form>
        )}

        {/* Reset Password Form - Enter Code and New Password */}
        {mode === "reset-password" && (
          <form onSubmit={handleUpdatePassword} className="animate-fade-in">
            <p
              className="text-[var(--text-secondary)]"
              style={{
                marginBottom: "var(--space-lg)",
                textAlign: "center",
                fontSize: "var(--text-sm)",
              }}
            >
              Enter the code from your email and choose a new password.
            </p>

            {/* Recovery code reminder */}
            <div
              className="flex items-start gap-3 p-3 rounded-lg mb-4"
              style={{
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                border: "1px solid var(--accent-primary)",
              }}
            >
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                style={{ color: "var(--accent-primary)" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p
                className="text-sm"
                style={{ color: "var(--accent-primary)" }}
              >
                After resetting, you may need your <strong>Recovery Code</strong> to restore encrypted messages. Find it in Settings.
              </p>
            </div>

            <div className="form-group">
              <label className="label" htmlFor="resetEmailField">
                Email Address
              </label>
              <input
                id="resetEmailField"
                type="email"
                className={`input ${error ? "input-error" : ""}`}
                placeholder="Enter your email address"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label className="label" htmlFor="resetCode">
                Reset Code
              </label>
              <input
                id="resetCode"
                type="text"
                className={`input ${error ? "input-error" : ""}`}
                placeholder="Enter 6-digit code from email"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                autoComplete="one-time-code"
                style={{
                  fontFamily: "monospace",
                  fontSize: "var(--text-lg)",
                  letterSpacing: "4px",
                  textAlign: "center",
                }}
                maxLength={6}
                required
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "var(--space-xs)",
                }}
              >
                <button
                  type="button"
                  onClick={handleResendResetCode}
                  disabled={resendCooldown > 0 || isLoading}
                  className="text-[var(--accent)] hover:underline"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                    fontSize: "var(--text-xs)",
                    padding: 0,
                    opacity: resendCooldown > 0 ? 0.5 : 1,
                  }}
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Resend code"}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="label" htmlFor="newPassword">
                New Password
              </label>
              <PasswordInput
                id="newPassword"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <p
                className="text-[var(--text-muted)]"
                style={{
                  fontSize: "var(--text-xs)",
                  marginTop: "var(--space-xs)",
                }}
              >
                Min 6 chars, uppercase, lowercase, number, symbol
              </p>
            </div>

            <div className="form-group">
              <label className="label" htmlFor="confirmNewPassword">
                Confirm New Password
              </label>
              <PasswordInput
                id="confirmNewPassword"
                placeholder="Confirm new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <div
                className="animate-shake"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <Alert variant="destructive" icon={<AlertCircleIcon />}>
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              </div>
            )}

            {success && (
              <div
                className="animate-fade-in"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <Alert variant="success" icon={<CheckCircleIcon />}>
                  <AlertTitle>{success}</AlertTitle>
                </Alert>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={isLoading || !resetEmail || !resetCode || !newPassword || !confirmNewPassword}
              style={{ background: "#3b82f6", marginBottom: "var(--space-md)" }}
            >
              {isLoading ? (
                <span
                  className="flex items-center justify-center"
                  style={{ gap: "var(--space-sm)" }}
                >
                  <LoadingSpinner />
                  Updating...
                </span>
              ) : (
                "Update Password"
              )}
            </button>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "var(--space-md)",
              }}
            >
              <button
                type="button"
                onClick={() => switchMode("forgot-password")}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                style={{
                  fontSize: "var(--text-sm)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Request new code
              </button>
              <span className="text-[var(--text-muted)]">•</span>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                style={{
                  fontSize: "var(--text-sm)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Back to login
              </button>
            </div>
          </form>
        )}

        {/* Encryption notice */}
        <p
          className="text-[var(--text-muted)]"
          style={{
            marginTop: "var(--space-xl)",
            fontSize: "var(--text-xs)",
            textAlign: "center",
          }}
        >
          🔒 Your prayers are end-to-end encrypted
        </p>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
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
  );
}
