'use client';

import { getVerseById } from '@/lib/verses';

interface VerseCardProps {
  verseId: number;
  className?: string;
  compact?: boolean;
  muted?: boolean;
}

export function VerseCard({ verseId, className = '', compact = false, muted = false }: VerseCardProps) {
  const verse = getVerseById(verseId);

  if (!verse) return null;

  if (compact) {
    return (
      <div className={`text-center ${className}`}>
        <p 
          className="font-serif italic text-[var(--text-muted)]"
          style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}
        >
          "{verse.text.substring(0, 80)}..."
        </p>
        <p 
          className="text-[var(--text-muted)]"
          style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-xs)' }}
        >
          — {verse.reference}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`
        card
        ${muted ? 'bg-[var(--surface-secondary)] border-transparent shadow-none' : ''}
        ${className}
      `}
      style={{ padding: 'var(--card-padding)' }}
    >
      {/* Verse text */}
      <blockquote>
        <p 
          className="font-serif italic text-[var(--text-secondary)]"
          style={{ 
            fontSize: 'var(--text-lg)', 
            lineHeight: 'var(--leading-loose)',
          }}
        >
          "{verse.text}"
        </p>
      </blockquote>

      {/* Reference */}
      <footer style={{ marginTop: 'var(--space-md)' }}>
        <cite 
          className="not-italic font-medium text-[var(--accent-primary)]"
          style={{ fontSize: 'var(--text-sm)' }}
        >
          — {verse.reference}
        </cite>
      </footer>
    </div>
  );
}
