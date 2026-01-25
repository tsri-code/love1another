import { NextRequest, NextResponse } from 'next/server';

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

// ==================== CONTENT VALIDATION ====================

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
