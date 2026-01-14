import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Auth callback handler for Supabase
 * 
 * This route handles:
 * 1. Email confirmation (signup verification via OTP link)
 * 2. OAuth callbacks
 * 
 * Note: Password reset now uses OTP code entry, not this callback.
 */
export async function GET(request: Request) {
  const requestUrl = request.url;
  const { searchParams, origin } = new URL(requestUrl);
  
  // Get the auth code from query params
  const code = searchParams.get('code');
  
  // Get the redirect destination (default to home)
  const next = searchParams.get('next') ?? '/';
  
  // Check for error
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  if (error) {
    console.error('Auth callback error:', error, errorDescription);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
  }

  if (code) {
    const cookieStore = await cookies();
    
    // Track cookies that need to be set on the response
    const cookiesToSet: { name: string; value: string; options?: CookieOptions }[] = [];
    
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(newCookies: { name: string; value: string; options?: CookieOptions }[]) {
          // Store cookies to set on the redirect response
          cookiesToSet.push(...newCookies);
          // Also try to set on cookie store (may fail in Route Handler)
          try {
            newCookies.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore - we'll set on redirect response
          }
        },
      },
    });
    
    // Exchange the code for a session
    const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code);
    
    if (data?.session) {
      console.log('Auth callback: Code exchange successful');
    }
    
    if (exchangeError) {
      console.error('Code exchange error:', exchangeError);
      return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
    }

    // Determine redirect destination
    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocalEnv = process.env.NODE_ENV === 'development';
    const baseUrl = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin);
    
    const response = NextResponse.redirect(`${baseUrl}${next}`);
    
    // Set all cookies on the redirect response
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        ...options,
      });
    });
    
    return response;
  }

  // If there's no code or an error occurred, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
