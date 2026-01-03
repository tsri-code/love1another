'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface LockTimerBannerProps {
  personId: string;
  onLock: () => void;
}

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const WARNING_THRESHOLD_MS = 30 * 1000;

export function LockTimerBanner({ personId, onLock }: LockTimerBannerProps) {
  const [remainingMs, setRemainingMs] = useState(LOCK_TIMEOUT_MS);
  const [showWarning, setShowWarning] = useState(false);
  const router = useRouter();

  const resetTimer = useCallback(() => {
    setRemainingMs(LOCK_TIMEOUT_MS);
    setShowWarning(false);
  }, []);

  const handleLock = useCallback(async () => {
    try {
      await fetch(`/api/people/${personId}/lock`, { method: 'POST' });
    } catch (error) {
      console.error('Error locking:', error);
    }
    onLock();
    router.push(`/p/${personId}`);
  }, [personId, onLock, router]);

  useEffect(() => {
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'focus'];

    const handleActivity = () => {
      resetTimer();
      fetch('/api/session', { method: 'POST' }).catch(() => {});
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    const interval = setInterval(() => {
      setRemainingMs(prev => {
        const newValue = prev - 1000;
        
        if (newValue <= WARNING_THRESHOLD_MS && !showWarning) {
          setShowWarning(true);
        }
        
        if (newValue <= 0) {
          handleLock();
          return 0;
        }
        
        return newValue;
      });
    }, 1000);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(interval);
    };
  }, [resetTimer, handleLock, showWarning]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetch('/api/session')
          .then(res => res.json())
          .then(data => {
            if (!data.authenticated || data.personId !== personId) {
              handleLock();
            }
          })
          .catch(() => handleLock());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [personId, handleLock]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!showWarning) return null;

  return (
    <div 
      className="fixed left-1/2 -translate-x-1/2 z-50 animate-slide-up"
      style={{ bottom: 'var(--space-lg)' }}
    >
      <div 
        className="card card-elevated flex items-center bg-[var(--text-primary)] text-[var(--text-inverse)]"
        style={{ 
          padding: 'var(--space-md) var(--space-lg)',
          gap: 'var(--space-md)',
        }}
      >
        <svg className="animate-pulse" style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-medium">
          Locking in {formatTime(remainingMs)}
        </span>
        <button
          onClick={resetTimer}
          className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors font-medium"
          style={{ 
            padding: 'var(--space-xs) var(--space-md)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Stay Active
        </button>
      </div>
    </div>
  );
}
