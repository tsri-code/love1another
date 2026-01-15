import { createBrowserClient } from '@supabase/ssr';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Create a Supabase client for use in the browser (Client Components)
 * This client respects RLS policies based on the authenticated user
 *
 * IMPORTANT: We disable automatic token refresh to prevent the refresh loop
 * issue where Supabase keeps retrying with invalid tokens. Token refresh is
 * handled manually in AuthGuard with proper error handling.
 *
 * Note: We're not using strict database types here because the Supabase
 * schema may not be fully set up yet. Once the migration is complete,
 * add back: createBrowserClient<Database>(...)
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // CRITICAL: Disable automatic token refresh to prevent infinite loops
      // when refresh tokens are invalid. We handle refresh manually in AuthGuard.
      autoRefreshToken: false,
      // Still persist the session to storage
      persistSession: true,
      // Detect OAuth/magic link tokens in URL
      detectSessionInUrl: true,
    },
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
