/**
 * Supabase Initialization Script
 * 
 * This module runs IMMEDIATELY when imported, BEFORE any Supabase client is created.
 * It validates and clears stale auth tokens to prevent refresh loops.
 * 
 * CRITICAL: This must run before createClient() is called anywhere.
 */

if (typeof window !== "undefined") {
  // Run immediately - don't wait for React or anything else
  (() => {
    try {
      // Check for Supabase auth tokens in localStorage
      const supabaseKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
          supabaseKeys.push(key);
        }
      }

      // If we have tokens, validate them before Supabase tries to use them
      if (supabaseKeys.length > 0) {
        for (const key of supabaseKeys) {
          const value = localStorage.getItem(key);
          if (!value) continue;

          try {
            const parsed = JSON.parse(value);
            
            // Check if we have refresh token but no access token - this is invalid
            if (parsed.refresh_token && !parsed.access_token) {
              console.log("[Supabase Init] Refresh token without access token, clearing storage");
              // Clear all Supabase keys
              for (let j = 0; j < localStorage.length; j++) {
                const k = localStorage.key(j);
                if (k && (k.startsWith("sb-") || k.includes("supabase"))) {
                  localStorage.removeItem(k);
                }
              }
              for (let j = 0; j < sessionStorage.length; j++) {
                const k = sessionStorage.key(j);
                if (k && (k.startsWith("sb-") || k.includes("supabase"))) {
                  sessionStorage.removeItem(k);
                }
              }
              break;
            }

            // Check if access token exists and is expired
            if (parsed.access_token) {
              try {
                // Decode JWT to check expiry
                const parts = parsed.access_token.split('.');
                if (parts.length === 3) {
                  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                  const expiresAt = payload.exp;
                  const now = Math.floor(Date.now() / 1000);
                  
                  // If token is expired or expires in less than 60 seconds, clear it
                  if (expiresAt && expiresAt < now + 60) {
                    // Token is expired - clear ALL Supabase storage to prevent refresh attempts
                    console.log("[Supabase Init] Expired token detected, clearing auth storage");
                    
                    // Clear all Supabase keys
                    for (let j = 0; j < localStorage.length; j++) {
                      const k = localStorage.key(j);
                      if (k && (k.startsWith("sb-") || k.includes("supabase"))) {
                        localStorage.removeItem(k);
                      }
                    }
                    
                    for (let j = 0; j < sessionStorage.length; j++) {
                      const k = sessionStorage.key(j);
                      if (k && (k.startsWith("sb-") || k.includes("supabase"))) {
                        sessionStorage.removeItem(k);
                      }
                    }
                    
                    // Break - we've cleared everything
                    break;
                  }
                }
              } catch {
                // If we can't parse the token, it's invalid - clear it
                console.log("[Supabase Init] Invalid token format, clearing auth storage");
                for (let j = 0; j < localStorage.length; j++) {
                  const k = localStorage.key(j);
                  if (k && (k.startsWith("sb-") || k.includes("supabase"))) {
                    localStorage.removeItem(k);
                  }
                }
                for (let j = 0; j < sessionStorage.length; j++) {
                  const k = sessionStorage.key(j);
                  if (k && (k.startsWith("sb-") || k.includes("supabase"))) {
                    sessionStorage.removeItem(k);
                  }
                }
                break;
              }
            }
          } catch {
            // Malformed JSON - clear it
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      // If anything fails, don't break the app - just log
      console.warn("[Supabase Init] Error during initialization:", error);
    }
  })();
}
