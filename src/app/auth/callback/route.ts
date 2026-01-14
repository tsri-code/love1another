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

    // Determine redirect destination
    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocalEnv = process.env.NODE_ENV === 'development';
    const baseUrl = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin);
    
    // If this is a password recovery, redirect to the reset password form
    if (isRecovery) {
      return NextResponse.redirect(`${baseUrl}/login?mode=reset-password`);
    }

    // Successful auth - redirect to the app
    return NextResponse.redirect(`${baseUrl}${next}`);
  }

  // If there's no code or an error occurred, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
