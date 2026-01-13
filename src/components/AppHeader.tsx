'use client';

import Link from 'next/link';

interface AppHeaderProps {
  showBack?: boolean;
  backHref?: string;
  onBack?: () => void;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AppHeader({
  showBack,
  backHref = '/',
  onBack,
  title,
  subtitle,
  actions,
}: AppHeaderProps) {
  return (
    <header 
      className="sticky top-0 z-40 bg-[var(--bg-primary)] border-b border-[var(--border-light)]"
      style={{ 
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(var(--bg-primary), 0.95)',
      }}
    >
      <div 
        className="container flex items-center justify-between"
        style={{ height: '56px' }}
      >
        {/* Left side */}
        <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
          {showBack && (
            onBack ? (
              <button
                onClick={onBack}
                className="icon-btn"
                style={{ marginLeft: 'calc(-1 * var(--space-sm))' }}
                aria-label="Go back"
              >
                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <Link 
                href={backHref} 
                className="icon-btn" 
                style={{ marginLeft: 'calc(-1 * var(--space-sm))' }}
                aria-label="Go back"
              >
                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
            )
          )}
          {title && (
            <div>
              <h1 
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{ fontSize: 'var(--text-lg)' }}
              >
                {title}
              </h1>
              {subtitle && (
                <p 
                  className="text-[var(--text-muted)]"
                  style={{ fontSize: 'var(--text-xs)' }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center" style={{ gap: 'var(--space-xs)' }}>
          {actions}
        </div>
      </div>
    </header>
  );
}
