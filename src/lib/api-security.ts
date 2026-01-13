import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ==================== RATE LIMITING ====================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit store (for single-instance deployments)
// For production with multiple instances, use Redis or similar
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Identifier for the rate limit (e.g., 'login', 'signup') */
  identifier: string;
}

/**
 * Pre-configured rate limits for common operations
 */
export const rateLimits = {
  // Auth operations - strict limits
  login: { maxRequests: 5, windowSeconds: 60, identifier: 'login' },
  signup: { maxRequests: 3, windowSeconds: 60, identifier: 'signup' },
  passwordReset: { maxRequests: 3, windowSeconds: 300, identifier: 'password-reset' },
  
  // Read operations - generous limits
  read: { maxRequests: 100, windowSeconds: 60, identifier: 'read' },
  
  // Write operations - moderate limits
  write: { maxRequests: 30, windowSeconds: 60, identifier: 'write' },
  
  // Prayer operations - specific limits
  prayer: { maxRequests: 50, windowSeconds: 60, identifier: 'prayer' },
  
  // Profile operations
  profile: { maxRequests: 20, windowSeconds: 60, identifier: 'profile' },
} as const;

/**
 * Check and apply rate limiting
 * Returns true if rate limited, false if allowed
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): { limited: boolean; remaining: number; resetAt: number } {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             request.headers.get('x-real-ip') ||
             'unknown';
  
  const key = `${config.identifier}:${ip}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, entry);
    return { limited: false, remaining: config.maxRequests - 1, resetAt: entry.resetAt };
  }

  if (entry.count >= config.maxRequests) {
    // Rate limited
    return { limited: true, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  return { limited: false, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Create a rate limited response
 */
export function rateLimitedResponse(resetAt: number): NextResponse {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { 
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      }
    }
  );
}

// ==================== INPUT VALIDATION ====================

/**
 * Common validation schemas
 */
export const schemas = {
  // User registration
  userRegistration: z.object({
    fullName: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    email: z.string().email('Invalid email address'),
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username too long')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    password: z.string()
      .min(6, 'Password must be at least 6 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one symbol'),
  }),

  // Login
  userLogin: z.object({
    identifier: z.string().min(1, 'Username or email is required'),
    password: z.string().min(1, 'Password is required'),
  }),

  // Friend request
  friendRequest: z.object({
    toUserId: z.string().uuid('Invalid user ID'),
  }),

  // Message
  message: z.object({
    content: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
    type: z.enum(['message', 'prayer_request']).optional().default('message'),
  }),

  // Prayer
  prayer: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    notes: z.string().max(2000, 'Notes too long').optional(),
    category: z.enum(['immediate', 'ongoing']),
  }),

  // Person/Profile
  person: z.object({
    displayName: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    type: z.enum(['person', 'group']).optional().default('person'),
  }),
};

/**
 * Validate request body against a schema
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    
    if (!result.success) {
      const firstError = result.error.issues[0];
      return { success: false, error: firstError.message };
    }
    
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: 'Invalid JSON body' };
  }
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

// ==================== CSRF PROTECTION ====================

/**
 * With Supabase Auth, CSRF protection is handled via:
 * 1. Secure, SameSite cookies for session management
 * 2. JWT tokens that are validated server-side
 * 3. API routes verify the user via supabase.auth.getUser()
 * 
 * For additional protection on sensitive endpoints, we can check
 * custom headers or use the origin validation below.
 */

/**
 * Middleware to check for CSRF protection via custom header
 * Browsers won't send custom headers on cross-origin requests without CORS preflight
 */
export function requireCSRF(request: NextRequest): NextResponse | null {
  // Check for a custom header that indicates the request came from our app
  const customHeader = request.headers.get('x-requested-with');
  
  // In development, skip CSRF check
  if (process.env.NODE_ENV === 'development') {
    return null;
  }
  
  // For production, require the custom header on non-GET requests
  if (request.method !== 'GET' && customHeader !== 'XMLHttpRequest') {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 403 }
    );
  }
  return null;
}

// ==================== REQUEST ORIGIN VALIDATION ====================

/**
 * Validate that the request comes from an allowed origin
 */
export function validateOrigin(request: NextRequest, allowedOrigins?: string[]): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Allow requests without origin (same-origin, curl, etc.)
  if (!origin && !referer) return true;
  
  // In development, allow localhost
  if (process.env.NODE_ENV === 'development') {
    if (origin?.includes('localhost') || referer?.includes('localhost')) {
      return true;
    }
  }
  
  // Check against allowed origins
  if (allowedOrigins && allowedOrigins.length > 0) {
    const requestOrigin = origin || new URL(referer || '').origin;
    return allowedOrigins.some(allowed => requestOrigin === allowed);
  }
  
  // By default, trust same-origin requests
  return true;
}

/**
 * Create an origin validation error response
 */
export function originErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Request origin not allowed' },
    { status: 403 }
  );
}

// ==================== COMBINED SECURITY MIDDLEWARE ====================

export interface SecurityOptions {
  rateLimit?: RateLimitConfig;
  validateCSRF?: boolean;
  validateOrigin?: boolean;
  allowedOrigins?: string[];
}

/**
 * Apply security checks to a request
 * Returns a NextResponse if any check fails, null if all pass
 */
export function applySecurityChecks(
  request: NextRequest,
  options: SecurityOptions
): NextResponse | null {
  // Rate limiting
  if (options.rateLimit) {
    const result = checkRateLimit(request, options.rateLimit);
    if (result.limited) {
      return rateLimitedResponse(result.resetAt);
    }
  }

  // CSRF validation (for non-GET requests)
  if (options.validateCSRF && request.method !== 'GET') {
    const csrfError = requireCSRF(request);
    if (csrfError) return csrfError;
  }

  // Origin validation
  if (options.validateOrigin) {
    if (!validateOrigin(request, options.allowedOrigins)) {
      return originErrorResponse();
    }
  }

  return null;
}

// ==================== CONTENT VALIDATION ====================

/**
 * Maximum allowed request body size (in bytes)
 */
export const MAX_BODY_SIZE = 1024 * 1024; // 1MB

/**
 * Sanitize a string to prevent XSS
 * Basic HTML entity encoding
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Check if a string contains potentially dangerous content
 */
export function containsDangerousContent(str: string): boolean {
  const dangerousPatterns = [
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onerror=, etc.
    /data:\s*text\/html/i,
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(str));
}

/**
 * Validate that content is safe for storage
 */
export function validateContent(content: string): { valid: boolean; error?: string } {
  if (content.length > 10000) {
    return { valid: false, error: 'Content too long (max 10,000 characters)' };
  }
  
  if (containsDangerousContent(content)) {
    return { valid: false, error: 'Content contains potentially unsafe elements' };
  }
  
  return { valid: true };
}
