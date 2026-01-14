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
 * 2. Password reset confirmation
 * 
 * The flow is:
 * 1. User clicks link in email
 * 2. Supabase redirects to this callback with auth code
 * 3. We exchange the code for a session
 * 4. User is redirected to the app (or password reset form if recovery)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  
  // Get the auth code from query params
  const code = searchParams.get('code');
  
  // Get the redirect destination (default to home)
  const next = searchParams.get('next') ?? '/';
  
  // Check if this is a password recovery flow
  const type = searchParams.get('type');
  const isRecovery = type === 'recovery';
  
  console.log('🔐 AUTH CALLBACK - Starting', { hasCode: !!code, isRecovery, type });
  
  // Check for error
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  if (error) {
    console.error('❌ AUTH CALLBACK - Error in URL params:', error, errorDescription);
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
          console.log('🍪 AUTH CALLBACK - Setting cookies:', newCookies.length);
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
    
    console.log('🔄 AUTH CALLBACK - Exchanging code for session...');
    // Exchange the code for a session
    const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code);
    
    if (data?.session) {
      console.log('✅ AUTH CALLBACK - Code exchange SUCCESS, session established');
    }
    
    if (exchangeError) {
      console.error('❌ AUTH CALLBACK - Code exchange FAILED:', exchangeError.message);
      // Provide specific error for expired/used links
      const errorMsg = exchangeError.message.includes('expired') || exchangeError.message.includes('invalid')
        ? 'link_expired'
        : 'auth_callback_error';
      console.log(`🔀 AUTH CALLBACK - Redirecting to login with error: ${errorMsg}`);
      return NextResponse.redirect(`${origin}/login?error=${errorMsg}`);
    }

    // Determine redirect destination
    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocalEnv = process.env.NODE_ENV === 'development';
    const baseUrl = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin);
    
    // Create redirect response
    const redirectUrl = isRecovery 
      ? `${baseUrl}/login?mode=reset-password`
      : `${baseUrl}${next}`;
    
    console.log(`🔀 AUTH CALLBACK - Redirecting to: ${redirectUrl}`);
    console.log(`🍪 AUTH CALLBACK - Setting ${cookiesToSet.length} cookies on redirect`);
    
    const response = NextResponse.redirect(redirectUrl);
    
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
