import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware to handle Supabase cookie synchronization and security
 * Does NOT block on getUser() - just syncs cookies
 */
export async function middleware(request: NextRequest) {
  // Security: Block requests with suspicious patterns
  const pathname = request.nextUrl.pathname;

  // Block common exploit paths
  const blockedPatterns = [
    /\.\.\//, // Path traversal
    /\.(php|asp|aspx|jsp|cgi)$/i, // Server-side scripts
    /wp-admin|wp-login|wp-content/i, // WordPress exploits
    /\.env|\.git|\.svn/i, // Config files
    /admin\.php|shell\.php/i, // Common exploit files
  ];

  if (blockedPatterns.some((pattern) => pattern.test(pathname))) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Get Supabase URL early for CSP headers
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let supabaseResponse = NextResponse.next({ request });

  // Add security headers to all responses
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
  supabaseResponse.headers.set("X-Frame-Options", "DENY");
  supabaseResponse.headers.set("X-XSS-Protection", "1; mode=block");
  supabaseResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  supabaseResponse.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  // Add Content Security Policy for HTML pages (not API routes)
  if (!pathname.startsWith("/api/")) {
    // CSP allows: self, inline styles (for Tailwind), Google Fonts, Supabase
    const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : "";
    supabaseResponse.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires these
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        `img-src 'self' data: blob: ${supabaseHost ? `https://${supabaseHost}` : ""}`,
        `connect-src 'self' ${supabaseHost ? `https://${supabaseHost} wss://${supabaseHost}` : ""}`,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ")
    );
  }

  // Add security headers to API responses
  if (pathname.startsWith("/api/")) {
    supabaseResponse.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );
    supabaseResponse.headers.set("Pragma", "no-cache");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  // Cookie options for persistent sessions
  const cookieOptions: CookieOptions = {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };

  // Create server client for cookie handling only
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: CookieOptions }[]
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...cookieOptions,
            ...options, // Allow Supabase to override if needed
          })
        );
      },
    },
  });

  // Just refresh the session without blocking - this syncs cookies
  // Use a short timeout to prevent hanging
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 2000)
    );
    await Promise.race([supabase.auth.getSession(), timeoutPromise]);
  } catch {
    // Timeout or error - just continue, AuthGuard will handle auth
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
