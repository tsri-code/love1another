'use client';

import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';

// Prayer types (moved from deleted db.ts)
export type PrayerCategory = 'immediate' | 'ongoing';

export interface Prayer {
  id: string;
  text: string;
  category: PrayerCategory;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  answered: boolean;
  answeredAt: string | null;
  lastPrayedAt: string | null;
  notAnsweredNote: string | null;
  tags: string[];
}

interface PrayerCardProps {
  prayer: Prayer;
  onUpdate: (updates: Partial<Prayer>) => void;
  onDelete: () => void;
  onMarkPrayed: () => void;
  compact?: boolean; // For column layout
  onShareToMessage?: (prayerText: string) => void; // Callback to send prayer as message
}

export function PrayerCard({
  prayer,
  onUpdate,
  onDelete,
  onMarkPrayed,
  compact = false,
  onShareToMessage,
}: PrayerCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(prayer.text);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNotAnsweredPrompt, setShowNotAnsweredPrompt] = useState(false);
  const [notAnsweredNote, setNotAnsweredNote] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyPrayer = async () => {
    try {
      await navigator.clipboard.writeText(prayer.text);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
        setShowShareMenu(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSendAsMessage = () => {
    setShowShareMenu(false);
    if (onShareToMessage) {
      onShareToMessage(prayer.text);
    }
  };

  const handleSave = () => {
    if (editText.trim() && editText !== prayer.text) {
      onUpdate({ text: editText.trim() });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(prayer.text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleMarkAnswered = () => {
    onUpdate({
      answered: true,
      answeredAt: new Date().toISOString(),
      notAnsweredNote: null,
    });
    setShowMenu(false);
  };

  const handleMarkNotAnswered = () => {
    setShowNotAnsweredPrompt(true);
    setShowMenu(false);
  };

  const handleSubmitNotAnswered = () => {
    onUpdate({
      answered: true,
      answeredAt: new Date().toISOString(),
      notAnsweredNote: notAnsweredNote.trim() || 'Prayer closed without answer',
    });
    setShowNotAnsweredPrompt(false);
    setNotAnsweredNote('');
  };

  const handleMoveToCategory = (category: PrayerCategory) => {
    // When moving to a category, also mark as unanswered
    onUpdate({
      category,
      answered: false,
      answeredAt: null,
      notAnsweredNote: null,
    });
    setShowMenu(false);
  };

  const handleTogglePin = () => {
    onUpdate({ pinned: !prayer.pinned });
    setShowMenu(false);
  };

  // Get the current category (default to 'immediate' for legacy prayers)
  const currentCategory = prayer.category || 'immediate';

  return (
    <div
      className={`
        card transition-all duration-200 relative
        ${prayer.pinned ? 'ring-2 ring-[var(--accent-primary)] ring-opacity-40 bg-[var(--surface-secondary)]' : ''}
        ${prayer.answered ? 'opacity-80' : ''}
      `}
      style={{
        overflow: 'visible',
        padding: compact ? 'var(--space-md)' : undefined,
        zIndex: showMenu ? 9999 : 'auto',
        isolation: showMenu ? 'isolate' : 'auto',
      }}
    >
      {/* Badges */}
      {(prayer.pinned || prayer.notAnsweredNote) && (
        <div className="flex items-center flex-wrap" style={{ gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
          {prayer.pinned && (
            <span
              className="badge bg-[var(--accent-primary)] text-white flex items-center"
              style={{ gap: '4px' }}
            >
              <svg style={{ width: '12px', height: '12px' }} fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
              </svg>
              Pinned
            </span>
          )}
          {prayer.notAnsweredNote && (
            <span className="badge bg-[var(--text-muted)] text-white flex items-center" style={{ gap: '4px' }}>
              <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Closed
            </span>
          )}
        </div>
      )}

      {/* Prayer text */}
      {isEditing ? (
        <div>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="input textarea"
            autoFocus
            style={{ minHeight: '80px' }}
          />
          <div className="flex" style={{ gap: 'var(--space-xs)', marginTop: 'var(--space-sm)' }}>
            <button onClick={handleSave} className="btn btn-primary btn-sm">
              Save
            </button>
            <button onClick={handleCancel} className="btn btn-secondary btn-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p
          className={`whitespace-pre-wrap ${prayer.answered && !prayer.notAnsweredNote ? 'line-through opacity-60' : ''}`}
          style={{
            lineHeight: '1.6',
            fontSize: compact ? 'var(--text-base)' : 'var(--text-lg)',
            fontWeight: 500,
            color: 'var(--text-bright)',
          }}
        >
          {prayer.text}
        </p>
      )}

      {/* Not answered note */}
      {prayer.notAnsweredNote && (
        <div
          className="bg-[var(--bg-secondary)] rounded-[var(--radius-sm)]"
          style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-sm)' }}
        >
          <p className="text-[var(--text-muted)]" style={{ fontSize: 'var(--text-sm)' }}>
            <span className="font-medium">What happened:</span> {prayer.notAnsweredNote}
          </p>
        </div>
      )}

      {/* Footer */}
      {!isEditing && (
        <div
          className="flex items-center justify-between border-t border-[var(--border-light)]"
          style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)' }}
        >
          {/* Meta */}
          <div style={{ fontSize: 'var(--text-xs)' }}>
            {prayer.answered && prayer.answeredAt ? (
              <>
                <p className="text-[var(--text-muted)]">
                  Started {format(new Date(prayer.createdAt), 'MMM d, yyyy')}
                </p>
                <p className={prayer.notAnsweredNote ? 'text-[var(--text-muted)]' : 'text-[var(--success)]'} style={{ marginTop: '2px' }}>
                  {prayer.notAnsweredNote ? 'Closed' : '✓ Answered'} {format(new Date(prayer.answeredAt), 'MMM d, yyyy')}
                </p>
              </>
            ) : (
              <>
                <p className="text-[var(--text-muted)]">
                  Added {formatDistanceToNow(new Date(prayer.createdAt), { addSuffix: true })}
                </p>
                {prayer.lastPrayedAt && (
                  <p className="text-[var(--success)] font-medium" style={{ marginTop: '2px' }}>
                    ♡ Prayed {formatDistanceToNow(new Date(prayer.lastPrayedAt), { addSuffix: true })}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center" style={{ gap: '4px' }}>
            {!prayer.answered && (
              <span className="tooltip-wrapper" data-tooltip="Mark as prayed">
                <button
                  onClick={onMarkPrayed}
                  className="icon-btn hover:text-[var(--error)] hover:bg-[var(--error-light)]"
                >
                  <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </span>
            )}

            {/* Share Button */}
            <div className="relative" ref={shareMenuRef}>
              <span className="tooltip-wrapper" data-tooltip="Share">
                <button
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="icon-btn hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary-light)]"
                >
                  <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
              </span>

              {showShareMenu && (
                <div 
                  className="absolute right-0 bottom-full card card-elevated animate-scale-in origin-bottom-right"
                  style={{ 
                    marginBottom: '8px', 
                    width: '180px', 
                    padding: 'var(--space-sm)',
                    zIndex: 99999,
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.15)',
                  }}
                >
                  <button
                    onClick={handleCopyPrayer}
                    className="w-full text-left flex items-center hover:bg-[var(--bg-secondary)] rounded-[var(--card-radius-sm)] transition-colors"
                    style={{ gap: 'var(--space-sm)', padding: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}
                  >
                    {copySuccess ? (
                      <>
                        <svg style={{ width: '16px', height: '16px' }} className="text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-[var(--success)]">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg style={{ width: '16px', height: '16px' }} className="text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Prayer
                      </>
                    )}
                  </button>

                  {onShareToMessage && (
                    <>
                      <div className="divider" style={{ margin: 'var(--space-xs) 0' }} />
                      <button
                        onClick={handleSendAsMessage}
                        className="w-full text-left flex items-center hover:bg-[var(--bg-secondary)] rounded-[var(--card-radius-sm)] transition-colors"
                        style={{ gap: 'var(--space-sm)', padding: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}
                      >
                        <svg style={{ width: '16px', height: '16px' }} className="text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Send as Message
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="icon-btn"
                aria-label="Prayer actions"
              >
                <svg style={{ width: '18px', height: '18px' }} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              {showMenu && (
                <div
                  className="absolute right-0 bottom-full card card-elevated animate-scale-in origin-bottom-right"
                  style={{
                    marginBottom: '8px',
                    width: '220px',
                    padding: 'var(--space-sm)',
                    zIndex: 99999,
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.15)',
                  }}
                >
                  {/* Edit - always available */}
                  <button
                    onClick={() => { setIsEditing(true); setShowMenu(false); }}
                    className="w-full text-left flex items-center hover:bg-[var(--bg-secondary)] rounded-[var(--card-radius-sm)] transition-colors"
                    style={{ gap: 'var(--space-sm)', padding: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}
                  >
                    <svg style={{ width: '16px', height: '16px' }} className="text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>

                  {/* Move to category options */}
                  <div className="divider" style={{ margin: 'var(--space-xs) 0' }} />
                  <p
                    className="text-[var(--text-muted)] font-medium"
                    style={{ fontSize: 'var(--text-xs)', padding: '4px 8px' }}
                  >
                    Move to:
                  </p>

                  {/* Move to Immediate */}
                  <button
                    onClick={() => handleMoveToCategory('immediate')}
                    className={`w-full text-left flex items-center hover:bg-[var(--bg-secondary)] rounded-[var(--card-radius-sm)] transition-colors ${
                      !prayer.answered && currentCategory === 'immediate' ? 'opacity-50' : ''
                    }`}
                    style={{ gap: 'var(--space-sm)', padding: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}
                    disabled={!prayer.answered && currentCategory === 'immediate'}
                  >
                    <svg style={{ width: '16px', height: '16px' }} className="text-[var(--accent-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className={!prayer.answered && currentCategory === 'immediate' ? '' : 'text-[var(--text-primary)]'}>
                      Immediate
                    </span>
                    {!prayer.answered && currentCategory === 'immediate' && (
                      <span className="text-[var(--text-muted)] ml-auto">Current</span>
                    )}
                  </button>

                  {/* Move to Ongoing */}
                  <button
                    onClick={() => handleMoveToCategory('ongoing')}
                    className={`w-full text-left flex items-center hover:bg-[var(--bg-secondary)] rounded-[var(--card-radius-sm)] transition-colors ${
                      !prayer.answered && currentCategory === 'ongoing' ? 'opacity-50' : ''
                    }`}
                    style={{ gap: 'var(--space-sm)', padding: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}
                    disabled={!prayer.answered && currentCategory === 'ongoing'}
                  >
                    <svg style={{ width: '16px', height: '16px' }} className="text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className={!prayer.answered && currentCategory === 'ongoing' ? '' : 'text-[var(--text-primary)]'}>
                      Ongoing
                    </span>
                    {!prayer.answered && currentCategory === 'ongoing' && (
                      <span className="text-[var(--text-muted)] ml-auto">Current</span>
                    )}
                  </button>

                  {/* Only show Answer/Not Answered options for non-answered prayers */}
                  {!prayer.answered && (
                    <>
                      <div className="divider" style={{ margin: 'var(--space-xs) 0' }} />

                      {/* Pin toggle */}
                      <button
                        onClick={handleTogglePin}
                        className="w-full text-left flex items-center hover:bg-[var(--bg-secondary)] rounded-[var(--card-radius-sm)] transition-colors"
                        style={{ gap: 'var(--space-sm)', padding: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}
                      >
                        <svg style={{ width: '16px', height: '16px' }} className="text-[var(--text-muted)]" fill={prayer.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        {prayer.pinned ? 'Unpin' : 'Pin to top'}
                      </button>

                      <div className="divider" style={{ margin: 'var(--space-xs) 0' }} />

                      <button
                        onClick={handleMarkAnswered}
                        className="w-full text-left flex items-center hover:bg-[var(--bg-secondary)] rounded-[var(--card-radius-sm)] transition-colors"
                        style={{ gap: 'var(--space-sm)', padding: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}
                      >
                        <svg style={{ width: '16px', height: '16px' }} className="text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[var(--success)]">Mark Answered</span>
                      </button>

                      <button
                        onClick={handleMarkNotAnswered}
                        className="w-full text-left flex items-center hover:bg-[var(--bg-secondary)] rounded-[var(--card-radius-sm)] transition-colors"
                        style={{ gap: 'var(--space-sm)', padding: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}
                      >
                        <svg style={{ width: '16px', height: '16px' }} className="text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Not Answered
                      </button>
                    </>
                  )}

                  <div className="divider" style={{ margin: 'var(--space-xs) 0' }} />

                  <button
                    onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}
                    className="w-full text-left flex items-center text-[var(--error)] hover:bg-[var(--error-light)] rounded-[var(--card-radius-sm)] transition-colors"
                    style={{ gap: 'var(--space-sm)', padding: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}
                  >
                    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div
          className="bg-[var(--error-light)] border border-[var(--error)] border-opacity-30 rounded-[var(--card-radius-sm)]"
          style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)' }}
        >
          <p
            className="text-[var(--error)] font-medium"
            style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-sm)' }}
          >
            Delete this prayer request?
          </p>
          <div className="flex" style={{ gap: 'var(--space-xs)' }}>
            <button onClick={onDelete} className="btn btn-danger btn-sm">
              Delete
            </button>
            <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary btn-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Not answered prompt */}
      {showNotAnsweredPrompt && (
        <div
          className="bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-[var(--card-radius-sm)]"
          style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)' }}
        >
          <p
            className="text-[var(--text-primary)] font-medium"
            style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-sm)' }}
          >
            What happened instead?
          </p>
          <textarea
            value={notAnsweredNote}
            onChange={(e) => setNotAnsweredNote(e.target.value)}
            placeholder="Describe what happened or why you're closing this prayer..."
            className="input textarea"
            style={{ minHeight: '80px', marginBottom: 'var(--space-sm)' }}
            autoFocus
          />
          <div className="flex" style={{ gap: 'var(--space-xs)' }}>
            <button onClick={handleSubmitNotAnswered} className="btn btn-primary btn-sm">
              Save & Close Prayer
            </button>
            <button onClick={() => { setShowNotAnsweredPrompt(false); setNotAnsweredNote(''); }} className="btn btn-secondary btn-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
