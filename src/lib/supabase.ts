import { createBrowserClient } from '@supabase/ssr';
import { cleanupStaleAuth } from './auth-cleanup';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Track if cleanup has been run this session
let cleanupRun = false;

/**
 * Create a Supabase client for use in the browser (Client Components)
 * This client respects RLS policies based on the authenticated user
 * 
 * IMPORTANT: Before creating the client, we validate and clean up any
 * stale auth tokens to prevent the refresh loop issue.
 * 
 * Note: We're not using strict database types here because the Supabase
 * schema may not be fully set up yet. Once the migration is complete,
 * add back: createBrowserClient<Database>(...)
 */
export function createClient() {
  // Run cleanup before creating the client (only once per page load)
  if (typeof window !== 'undefined' && !cleanupRun) {
    cleanupRun = true;
    const cleaned = cleanupStaleAuth();
    if (cleaned) {
      console.log('[Supabase] Stale auth tokens were cleaned before client init');
    }
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      // Ensure cookies persist for 7 days (matches Supabase default session)
      maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  });
}

// Type exports for convenience
export type SupabaseClient = ReturnType<typeof createClient>;
