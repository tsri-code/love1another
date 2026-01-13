import { createBrowserClient } from '@supabase/ssr';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Create a Supabase client for use in the browser (Client Components)
 * This client respects RLS policies based on the authenticated user
 * 
 * Note: We're not using strict database types here because the Supabase
 * schema may not be fully set up yet. Once the migration is complete,
 * add back: createBrowserClient<Database>(...)
 */
export function createClient() {
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
