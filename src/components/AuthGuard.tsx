"use client";

import {
  useEffect,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { NotificationProvider } from "@/lib/use-notifications";

interface User {
  id: string;
  email: string;
  username: string;
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

/**
 * Clear all Supabase auth storage to reset to a clean state
 */
function clearAllAuthStorage() {
  if (typeof window === "undefined") return;

  // Clear localStorage
  const localKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
      localKeys.push(key);
    }
  }
  localKeys.forEach((key) => localStorage.removeItem(key));

  // Clear sessionStorage
  const sessionKeys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
      sessionKeys.push(key);
    }
  }
  sessionKeys.forEach((key) => sessionStorage.removeItem(key));
}

/**
 * Extract user data from Supabase user object
 */
function extractUserData(supabaseUser: SupabaseUser): User {
  const metadata = supabaseUser.user_metadata || {};
  const fullName =
    metadata.full_name ||
    metadata.name ||
    supabaseUser.email?.split("@")[0] ||
    "User";

  return {
    id: supabaseUser.id,
    email: supabaseUser.email || "",
    username: metadata.username || supabaseUser.email?.split("@")[0] || "",
    fullName,
    avatarInitials: metadata.avatar_initials || getInitials(fullName),
    avatarColor: metadata.avatar_color || "#7c9bb8",
    avatarPath: metadata.avatar_path || null,
  };
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // CRITICAL: Clear stale storage IMMEDIATELY on mount, before Supabase client is created
  // This prevents Supabase from trying to restore invalid sessions
  useMemo(() => {
    if (typeof window !== "undefined") {
      // Check if there's a flag indicating we should clear storage
      const shouldClear = sessionStorage.getItem("clearAuthStorage");
      if (shouldClear === "true") {
        clearAllAuthStorage();
        sessionStorage.removeItem("clearAuthStorage");
      }
    }
  }, []);

  // Memoize the Supabase client to prevent recreation on every render
  const supabase = useMemo(() => createClient(), []);

  // Track if we've completed initial auth check
  const authInitialized = useRef(false);

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

  /**
   * Validate and refresh session if needed
   * Returns the valid session or null if invalid
   */
  const validateSession = useCallback(async (): Promise<Session | null> => {
    try {
      // Get current session from storage (doesn't make network request)
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        console.warn("[Auth] Session error:", sessionError.message);
        clearAllAuthStorage();
        return null;
      }

      if (!sessionData?.session) {
        return null;
      }

      const session = sessionData.session;

      // Check if access token is expired
      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const isExpired = expiresAt && expiresAt < now + 60; // 60 second buffer

      if (isExpired) {
        // Try to refresh the session
        const { data: refreshData, error: refreshError } =
          await supabase.auth.refreshSession();

        if (refreshError) {
          console.warn("[Auth] Refresh failed:", refreshError.message);
          // Clear storage and sign out - refresh token is invalid
          clearAllAuthStorage();
          // Set flag to clear on next page load too
          if (typeof window !== "undefined") {
            sessionStorage.setItem("clearAuthStorage", "true");
          }
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {
            // Ignore
          }
          return null;
        }

        if (!refreshData?.session) {
          console.warn("[Auth] Refresh returned no session");
          clearAllAuthStorage();
          return null;
        }

        return refreshData.session;
      }

      // Token is still valid, verify with server
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) {
        console.warn("[Auth] User verification failed:", userError.message);
        // If user verification fails, the session is invalid
        clearAllAuthStorage();
        // Set flag to clear on next page load too
        if (typeof window !== "undefined") {
          sessionStorage.setItem("clearAuthStorage", "true");
        }
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // Ignore
        }
        return null;
      }

      if (!userData?.user) {
        console.warn("[Auth] No user data returned");
        clearAllAuthStorage();
        return null;
      }

      return session;
    } catch (error) {
      console.error("[Auth] Validation error:", error);
      clearAllAuthStorage();
      return null;
    }
  }, [supabase.auth]);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    if (authInitialized.current) return;
    authInitialized.current = true;

    const initAuth = async () => {
      // Skip auth if password reset is in progress
      if (
        typeof window !== "undefined" &&
        sessionStorage.getItem("passwordResetInProgress")
      ) {
        setIsLoading(false);
        return;
      }

      const session = await validateSession();

      if (session) {
        // Check "Remember Me" logic for returning sessions
        const rememberMe = localStorage.getItem("rememberMe");
        const sessionActive = sessionStorage.getItem("sessionActive");

        if (!rememberMe && !sessionActive) {
          // User didn't want to be remembered, and this is a new browser session
          await supabase.auth.signOut({ scope: "local" });
          setUser(null);
          setSupabaseUser(null);
          setIsLoading(false);
          if (!isPublicPage()) {
            router.push("/login");
          }
          return;
        }

        // Valid session - set user data
        setSupabaseUser(session.user);
        setUser(extractUserData(session.user));
      } else {
        // No valid session
        setUser(null);
        setSupabaseUser(null);
        if (!isPublicPage()) {
          router.push("/login");
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, [supabase.auth, validateSession, isPublicPage, router]);

  /**
   * Listen for auth state changes (login, logout, etc.)
   * Since we disabled autoRefreshToken, this only fires for explicit auth actions
   */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip if password reset is in progress
      if (
        typeof window !== "undefined" &&
        sessionStorage.getItem("passwordResetInProgress")
      ) {
        return;
      }

      switch (event) {
        case "SIGNED_IN":
          if (session) {
            setSupabaseUser(session.user);
            setUser(extractUserData(session.user));
            // Mark session as active for "Remember Me" logic
            sessionStorage.setItem("sessionActive", "true");
          }
          setIsLoading(false);
          break;

        case "SIGNED_OUT":
          setUser(null);
          setSupabaseUser(null);
          setIsLoading(false);
          // Don't redirect if we're already on a public page
          if (!isPublicPage() && pathname !== "/login") {
            router.push("/");
          }
          break;

        case "TOKEN_REFRESHED":
          if (session) {
            setSupabaseUser(session.user);
            setUser(extractUserData(session.user));
          }
          break;

        case "PASSWORD_RECOVERY":
          // User clicked password reset link - don't set user, let login page handle
          if (session) {
            setSupabaseUser(session.user);
          }
          setIsLoading(false);
          break;

        case "USER_UPDATED":
          if (session) {
            setSupabaseUser(session.user);
            setUser(extractUserData(session.user));
          }
          break;

        case "INITIAL_SESSION":
          // This is handled by initAuth on mount, skip here
          // to avoid duplicate processing
          break;

        default:
          break;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth, router, pathname, isPublicPage]);

  /**
   * Periodic token refresh (since we disabled auto-refresh)
   * Check every 5 minutes if token needs refresh
   */
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(
      async () => {
        const session = await validateSession();
        if (!session) {
          // Session became invalid - user needs to re-login
          setUser(null);
          setSupabaseUser(null);
          if (!isPublicPage()) {
            router.push("/login");
          }
        }
      },
      5 * 60 * 1000
    ); // 5 minutes

    return () => clearInterval(refreshInterval);
  }, [user, validateSession, isPublicPage, router]);

  const logout = async () => {
    try {
      // Clear encryption keys from IndexedDB
      if (typeof indexedDB !== "undefined") {
        try {
          indexedDB.deleteDatabase("love1another_crypto");
        } catch (e) {
          console.warn("Could not clear crypto DB:", e);
        }
      }

      // Clear remember me preferences
      if (typeof window !== "undefined") {
        localStorage.removeItem("rememberMe");
        sessionStorage.removeItem("sessionActive");
      }

      // Sign out locally
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Ignore errors
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
    setUser(null);
    setSupabaseUser(null);
    router.push("/");
  };

  const refreshUser = useCallback(async () => {
    const session = await validateSession();
    if (session) {
      setSupabaseUser(session.user);
      setUser(extractUserData(session.user));
    } else {
      setUser(null);
      setSupabaseUser(null);
    }
  }, [validateSession]);

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
          <NotificationProvider userId={user.id}>{children}</NotificationProvider>
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
