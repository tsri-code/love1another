'use client';

import Link from 'next/link';
import { useTheme } from '@/lib/theme';
import { useState, useRef, useEffect } from 'react';

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
  const { theme, setTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          
          {/* Settings menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="icon-btn"
              aria-label="Settings"
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>

            {showMenu && (
              <div 
                className="absolute right-0 top-full card card-elevated animate-scale-in origin-top-right"
                style={{ 
                  marginTop: 'var(--space-xs)', 
                  width: '220px',
                  padding: 'var(--space-sm)',
                }}
              >
                {/* Theme selector */}
                <div style={{ marginBottom: 'var(--space-sm)' }}>
                  <p 
                    className="text-[var(--text-muted)] uppercase"
                    style={{ 
                      fontSize: 'var(--text-xs)', 
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      marginBottom: 'var(--space-xs)',
                      paddingLeft: 'var(--space-xs)',
                    }}
                  >
                    Theme
                  </p>
                  <div 
                    className="flex bg-[var(--bg-secondary)] rounded-[var(--card-radius-sm)]"
                    style={{ padding: '4px', gap: '4px' }}
                  >
                    {(['light', 'dark', 'system'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={`
                          flex-1 rounded-[8px] capitalize transition-all
                          ${theme === t 
                            ? 'bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm' 
                            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                          }
                        `}
                        style={{
                          padding: 'var(--space-xs) var(--space-sm)',
                          fontSize: 'var(--text-sm)',
                          fontWeight: 500,
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divider" style={{ margin: 'var(--space-sm) 0' }} />

                {/* Passwords */}
                <Link
                  href="/passwords"
                  className="flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-[var(--card-radius-sm)] transition-colors"
                  style={{ 
                    gap: 'var(--space-sm)', 
                    padding: 'var(--space-sm)',
                    fontSize: 'var(--text-sm)',
                  }}
                  onClick={() => setShowMenu(false)}
                >
                  <svg style={{ width: '18px', height: '18px' }} className="text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  View Passwords
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
