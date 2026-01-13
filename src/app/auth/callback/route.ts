import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

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
 * 4. User is redirected to the app
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  
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
    const supabase = await createServerSupabaseClient();
    
    // Exchange the code for a session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error('Code exchange error:', exchangeError);
      return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
    }

    // Successful auth - redirect to the app
    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocalEnv = process.env.NODE_ENV === 'development';
    
    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${next}`);
    } else if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${next}`);
    } else {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If there's no code or an error occurred, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
