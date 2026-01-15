"use client";

import {
  useEffect,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { NotificationProvider } from "@/lib/use-notifications";

interface User {
  id: string;
  email: string;
  username: string; // Derived from email or user_metadata
  fullName: string;
  avatarInitials: string | null;
  avatarColor: string | null;
  avatarPath: string | null;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  supabaseUser: null,
  isLoading: true,
  logout: async () => {},
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Memoize the Supabase client to prevent recreation on every render
  const supabase = useMemo(() => createClient(), []);

  const checkAuth = useCallback(async () => {
    try {
      // First check if there's a session at all (with timeout)
      const sessionTimeoutPromise = new Promise<{ data: { session: null }; error: null }>(
        (resolve) =>
          setTimeout(() => resolve({ data: { session: null }, error: null }), 3000)
      );
      const { data: sessionData, error: sessionError } = await Promise.race([
        supabase.auth.getSession(),
        sessionTimeoutPromise,
      ]);

      // If we get a refresh token error, clear the session
      if (sessionError) {
        console.warn("Session error, clearing auth state:", sessionError.message);
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // Ignore signout errors
        }
        setUser(null);
        setSupabaseUser(null);
        return false;
      }

      if (!sessionData?.session) {
        setUser(null);
        setSupabaseUser(null);
        return false;
      }

      // Use getUser() with timeout to prevent infinite hang
      const timeoutPromise = new Promise<{ data: { user: null }; error: null }>(
        (resolve) =>
          setTimeout(() => resolve({ data: { user: null }, error: null }), 5000)
      );

      const {
        data: { user: supabaseUserData },
        error,
      } = (await Promise.race([
        supabase.auth.getUser(),
        timeoutPromise,
      ])) as Awaited<ReturnType<typeof supabase.auth.getUser>>;

      // If we get an auth error (like invalid refresh token), clear session
      if (error) {
        console.warn("Auth error, clearing auth state:", error.message);
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // Ignore signout errors
        }
        setUser(null);
        setSupabaseUser(null);
        return false;
      }

      if (!supabaseUserData) {
        setUser(null);
        setSupabaseUser(null);
        return false;
      }

      setSupabaseUser(supabaseUserData);

      // Extract user metadata
      const metadata = supabaseUserData.user_metadata || {};
      const fullName =
        metadata.full_name ||
        metadata.name ||
        supabaseUserData.email?.split("@")[0] ||
        "User";

      setUser({
        id: supabaseUserData.id,
        email: supabaseUserData.email || "",
        username:
          metadata.username || supabaseUserData.email?.split("@")[0] || "",
        fullName,
        avatarInitials: metadata.avatar_initials || getInitials(fullName),
        avatarColor: metadata.avatar_color || "#7c9bb8",
        avatarPath: metadata.avatar_path || null,
      });

      return true;
    } catch (error) {
      console.error("Auth check error:", error);
      setUser(null);
      setSupabaseUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const logout = async () => {
    try {
      // Clear encryption keys from IndexedDB
      if (typeof indexedDB !== "undefined") {
        try {
          const deleteRequest = indexedDB.deleteDatabase("love1another_crypto");
          deleteRequest.onerror = () =>
            console.warn("Could not clear crypto DB");
        } catch (e) {
          console.warn("Could not clear crypto DB:", e);
        }
      }

      // Clear remember me preferences
      if (typeof window !== "undefined") {
        localStorage.removeItem("rememberMe");
        sessionStorage.removeItem("sessionActive");
      }

      // Sign out - use local scope to avoid 403 errors
      // The 403 error on global scope is harmless but we'll avoid it
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (error) {
        // If local scope fails or isn't supported, try without scope
        // This is a non-critical error - user is already logged out locally
        const status =
          error && typeof error === "object" && "status" in error
            ? (error as { status?: number }).status
            : undefined;
        if (status !== 403) {
          try {
            await supabase.auth.signOut();
          } catch {
            // Silently ignore - logout still works
          }
        }
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
    setUser(null);
    setSupabaseUser(null);
    router.push("/");
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  // On mount, check for and clear any stale sessions that might cause refresh loops
  useEffect(() => {
    const clearStaleSession = async () => {
      try {
        const { error } = await supabase.auth.getSession();
        if (error && (error.message.includes("refresh") || error.message.includes("token"))) {
          console.warn("Stale session detected, clearing...");
          await supabase.auth.signOut({ scope: "local" });
        }
      } catch {
        // Ignore errors
      }
    };
    clearStaleSession();
  }, [supabase.auth]);

  // Check if current path is a public page that doesn't require auth
  const isPublicPage = useCallback(() => {
    return (
      pathname === "/" ||
      pathname === "/login" ||
      pathname === "/how-to-use" ||
      pathname === "/privacy" ||
      pathname === "/terms" ||
      pathname.startsWith("/auth/") ||
      pathname.startsWith("/donate") ||
      pathname.startsWith("/l/")
    );
  }, [pathname]);

  // Listen for auth state changes - this is the ONLY place we check auth
  useEffect(() => {
    // Track auth state change calls to detect loops
    let authChangeCount = 0;
    let lastAuthChangeTime = Date.now();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Detect and break out of auth loops
      const now = Date.now();
      if (now - lastAuthChangeTime < 1000) {
        authChangeCount++;
        if (authChangeCount > 5) {
          console.warn("Auth state change loop detected, breaking out");
          // Clear potentially corrupt session data
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {
            // Ignore errors during emergency signout
          }
          setUser(null);
          setSupabaseUser(null);
          setIsLoading(false);
          return;
        }
      } else {
        authChangeCount = 1;
      }
      lastAuthChangeTime = now;

      // Skip auth state handling if password reset is in progress
      // This prevents re-renders that can abort the password update request
      if (typeof window !== "undefined" && sessionStorage.getItem("passwordResetInProgress")) {
        return;
      }

      if (event === "INITIAL_SESSION") {
        // This fires when Supabase has loaded the initial session from storage
        const rememberMe = localStorage.getItem("rememberMe");
        const sessionActive = sessionStorage.getItem("sessionActive");

        // Handle "Remember Me" logic
        if (!rememberMe && !sessionActive && session) {
          // User didn't want to be remembered, and this is a new browser session
          await supabase.auth.signOut();
          setUser(null);
          setSupabaseUser(null);
          setIsLoading(false);
          if (!isPublicPage()) {
            router.push("/login");
          }
          return;
        }

        if (session) {
          // Session exists, set user data
          const supabaseUserData = session.user;
          setSupabaseUser(supabaseUserData);

          const metadata = supabaseUserData.user_metadata || {};
          const fullName =
            metadata.full_name ||
            metadata.name ||
            supabaseUserData.email?.split("@")[0] ||
            "User";

          setUser({
            id: supabaseUserData.id,
            email: supabaseUserData.email || "",
            username:
              metadata.username || supabaseUserData.email?.split("@")[0] || "",
            fullName,
            avatarInitials: metadata.avatar_initials || getInitials(fullName),
            avatarColor: metadata.avatar_color || "#7c9bb8",
            avatarPath: metadata.avatar_path || null,
          });
        } else {
          setUser(null);
          setSupabaseUser(null);
          if (!isPublicPage()) {
            router.push("/login");
          }
        }
        setIsLoading(false);
      } else if (event === "SIGNED_IN" && session) {
        const supabaseUserData = session.user;
        setSupabaseUser(supabaseUserData);

        const metadata = supabaseUserData.user_metadata || {};
        const fullName =
          metadata.full_name ||
          metadata.name ||
          supabaseUserData.email?.split("@")[0] ||
          "User";

        setUser({
          id: supabaseUserData.id,
          email: supabaseUserData.email || "",
          username:
            metadata.username || supabaseUserData.email?.split("@")[0] || "",
          fullName,
          avatarInitials: metadata.avatar_initials || getInitials(fullName),
          avatarColor: metadata.avatar_color || "#7c9bb8",
          avatarPath: metadata.avatar_path || null,
        });
        setIsLoading(false);
      } else if (event === "PASSWORD_RECOVERY" && session) {
        // OTP-based recovery: user is on login page entering code
        // Set session but don't set user (they haven't completed reset yet)
        // The login page handles the updateUser() and signOut()
        setSupabaseUser(session.user);
        setIsLoading(false);
        // Stay on login page - don't redirect anywhere
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setSupabaseUser(null);
        setIsLoading(false);
        if (!isPublicPage()) {
          router.push("/");
        }
      } else if (event === "TOKEN_REFRESHED" && session) {
        // Session was refreshed, update user data
        const supabaseUserData = session.user;
        setSupabaseUser(supabaseUserData);

        const metadata = supabaseUserData.user_metadata || {};
        const fullName =
          metadata.full_name ||
          metadata.name ||
          supabaseUserData.email?.split("@")[0] ||
          "User";

        setUser({
          id: supabaseUserData.id,
          email: supabaseUserData.email || "",
          username:
            metadata.username || supabaseUserData.email?.split("@")[0] || "",
          fullName,
          avatarInitials: metadata.avatar_initials || getInitials(fullName),
          avatarColor: metadata.avatar_color || "#7c9bb8",
          avatarPath: metadata.avatar_path || null,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router, checkAuth, supabase.auth, isPublicPage]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="page-center" style={{ background: "var(--bg-primary)" }}>
        <div
          className="animate-pulse flex flex-col items-center"
          style={{ gap: "var(--space-md)" }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            <img
              src="/favicon.jpeg"
              alt="Loading..."
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              suppressHydrationWarning
            />
          </div>
        </div>
      </div>
    );
  }

  // If on public page or authenticated, show children
  if (isPublicPage() || user) {
    return (
      <AuthContext.Provider
        value={{ user, supabaseUser, isLoading, logout, refreshUser }}
      >
        {user ? (
          <NotificationProvider userId={user.id}>
            {children}
          </NotificationProvider>
        ) : (
          children
        )}
      </AuthContext.Provider>
    );
  }

  // Fallback - redirecting
  return null;
}

// Utility function
function getInitials(name: string): string {
  if (!name) return "U";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
