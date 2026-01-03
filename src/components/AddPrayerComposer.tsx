'use client';

import { useState, useRef, useEffect } from 'react';
import type { PrayerCategory } from '@/lib/db';

interface AddPrayerComposerProps {
  onAdd: (text: string, category: PrayerCategory) => void;
  isLoading?: boolean;
  defaultCategory?: PrayerCategory;
}

export function AddPrayerComposer({ onAdd, isLoading, defaultCategory = 'immediate' }: AddPrayerComposerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<PrayerCategory>(defaultCategory);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  const handleSubmit = () => {
    if (text.trim() && !isLoading) {
      onAdd(text.trim(), category);
      setText('');
      setCategory(defaultCategory);
      setIsExpanded(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setIsExpanded(false);
      setText('');
    }
  };

  return (
    <div className="card overflow-hidden" style={{ padding: 0 }}>
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center text-left group hover:bg-[var(--surface-secondary)] transition-colors"
          style={{ padding: 'var(--space-lg)', gap: 'var(--space-md)' }}
        >
          <div 
            className="rounded-full bg-[var(--accent-primary-light)] flex items-center justify-center group-hover:bg-[var(--accent-primary)] group-hover:bg-opacity-20 transition-colors"
            style={{ width: '48px', height: '48px', flexShrink: 0 }}
          >
            <svg className="text-[var(--accent-primary)]" style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-[var(--text-primary)]">Add a prayer request</p>
            <p className="text-[var(--text-muted)]" style={{ fontSize: 'var(--text-sm)' }}>
              What's on your heart?
            </p>
          </div>
        </button>
      ) : (
        <div className="animate-fade-in" style={{ padding: 'var(--space-lg)' }}>
          {/* Category toggle */}
          <div 
            className="flex bg-[var(--bg-secondary)] rounded-[var(--radius-md)] p-1"
            style={{ marginBottom: 'var(--space-md)' }}
          >
            <button
              type="button"
              onClick={() => setCategory('immediate')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-sm)] transition-all ${
                category === 'immediate'
                  ? 'bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              style={{ padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--text-sm)', fontWeight: 500 }}
            >
              <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Immediate
            </button>
            <button
              type="button"
              onClick={() => setCategory('ongoing')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-sm)] transition-all ${
                category === 'ongoing'
                  ? 'bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              style={{ padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--text-sm)', fontWeight: 500 }}
            >
              <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Ongoing
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={category === 'immediate' 
              ? "A short-term or urgent prayer request..."
              : "A long-term or ongoing prayer request..."}
            className="input textarea"
            style={{ minHeight: '120px' }}
            disabled={isLoading}
            maxLength={5000}
          />
          
          <div 
            className="flex items-center justify-between"
            style={{ marginTop: 'var(--space-md)' }}
          >
            <span className="text-[var(--text-muted)]" style={{ fontSize: 'var(--text-xs)' }}>
              {text.length > 0 && `${text.length.toLocaleString()} / 5,000`}
            </span>
            
            <div className="flex" style={{ gap: 'var(--space-xs)' }}>
              <button
                onClick={() => {
                  setIsExpanded(false);
                  setText('');
                  setCategory(defaultCategory);
                }}
                className="btn btn-secondary btn-sm"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || isLoading}
                className="btn btn-primary btn-sm"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin" style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Adding...
                  </>
                ) : (
                  <>
                    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Prayer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
