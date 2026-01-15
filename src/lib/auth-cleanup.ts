/**
 * Auth Cleanup Utility
 * 
 * This module provides functions to validate and clean up stale auth tokens
 * BEFORE the Supabase client initializes. This prevents the refresh loop issue
 * where Supabase keeps trying to refresh invalid tokens.
 */

/**
 * Decode a JWT token without verification (just to read expiry)
 */
function decodeJWT(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Handle URL-safe base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is expired
 */
function isTokenExpired(token: string): boolean {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;
  // Add 60 second buffer for clock skew
  return decoded.exp * 1000 < Date.now() - 60000;
}

/**
 * Find and validate Supabase tokens in storage
 * Returns true if tokens are valid, false if they should be cleared
 */
function validateSupabaseTokens(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    // Look for Supabase auth storage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Supabase stores auth in keys like "sb-{project-ref}-auth-token"
      if (key.startsWith('sb-') && key.includes('-auth-token')) {
        const value = localStorage.getItem(key);
        if (!value) continue;
        
        try {
          const parsed = JSON.parse(value);
          
          // Check access token expiry
          if (parsed.access_token) {
            if (isTokenExpired(parsed.access_token)) {
              console.log('[Auth Cleanup] Access token is expired');
              return false;
            }
          }
          
          // Check refresh token - if it exists but access token is missing, that's invalid
          if (parsed.refresh_token && !parsed.access_token) {
            console.log('[Auth Cleanup] Refresh token without access token');
            return false;
          }
          
          // Check for malformed session
          if (parsed.user === null && (parsed.access_token || parsed.refresh_token)) {
            console.log('[Auth Cleanup] Tokens without user');
            return false;
          }
          
        } catch {
          // Malformed JSON - should be cleared
          console.log('[Auth Cleanup] Malformed auth storage');
          return false;
        }
      }
    }
    
    return true;
  } catch {
    return true; // On error, don't clear - let Supabase handle it
  }
}

/**
 * Clear all Supabase auth storage from localStorage and sessionStorage
 */
function clearSupabaseStorage(): void {
  if (typeof window === 'undefined') return;

  console.log('[Auth Cleanup] Clearing stale auth storage...');
  
  // Clear from localStorage
  const localKeysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
      localKeysToRemove.push(key);
    }
  }
  localKeysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log('[Auth Cleanup] Removed localStorage:', key);
  });
  
  // Clear from sessionStorage
  const sessionKeysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
      sessionKeysToRemove.push(key);
    }
  }
  sessionKeysToRemove.forEach(key => {
    sessionStorage.removeItem(key);
    console.log('[Auth Cleanup] Removed sessionStorage:', key);
  });
  
  // Clear loop detection flags too
  sessionStorage.removeItem('authLoopDetection');
  sessionStorage.removeItem('authLoopBreaker');
  sessionStorage.removeItem('authLoopBreaker_time');
}

/**
 * Main cleanup function - call this BEFORE creating Supabase client
 * Returns true if cleanup was performed
 */
export function cleanupStaleAuth(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check if we already cleaned up this session
  const cleanupDone = sessionStorage.getItem('authCleanupDone');
  if (cleanupDone === 'true') {
    return false;
  }
  
  // Validate tokens
  const tokensValid = validateSupabaseTokens();
  
  if (!tokensValid) {
    clearSupabaseStorage();
    // Mark that we've done cleanup to avoid re-running
    sessionStorage.setItem('authCleanupDone', 'true');
    return true;
  }
  
  return false;
}

/**
 * Force clear all auth - use when detecting a refresh loop
 */
export function forceClearAuth(): void {
  if (typeof window === 'undefined') return;
  clearSupabaseStorage();
  sessionStorage.setItem('authCleanupDone', 'true');
}

/**
 * Reset cleanup flag - call after successful login
 */
export function resetCleanupFlag(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('authCleanupDone');
}
