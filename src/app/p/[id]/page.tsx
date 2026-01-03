'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AvatarCircle } from '@/components/AvatarCircle';
import { PasscodeInput } from '@/components/PasscodeInput';
import { VerseCard } from '@/components/VerseCard';

interface Person {
  id: string;
  displayName: string;
  type: 'person' | 'group';
  avatarPath: string | null;
  avatarInitials: string | null;
  avatarColor: string | null;
  verseId: number;
}

export default function PersonGatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [person, setPerson] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | undefined>();
  const [lockoutSeconds, setLockoutSeconds] = useState<number | undefined>();
  const [useMaster, setUseMaster] = useState(false);
  const [hasMasterPasscode, setHasMasterPasscode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchPerson();
    checkMasterPasscode();
  }, [id]);

  const checkMasterPasscode = async () => {
    try {
      const res = await fetch('/api/passwords/setup');
      if (res.ok) {
        const data = await res.json();
        setHasMasterPasscode(data.isSetUp);
      }
    } catch {
      // Master passcode not available
    }
  };

  // Lockout countdown
  useEffect(() => {
    if (lockoutSeconds && lockoutSeconds > 0) {
      const timer = setInterval(() => {
        setLockoutSeconds(prev => {
          if (!prev || prev <= 1) {
            setError(null);
            return undefined;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutSeconds]);

  const fetchPerson = async () => {
    try {
      const res = await fetch(`/api/people/${id}`);
      if (!res.ok) {
        router.push('/');
        return;
      }
      const data = await res.json();
      setPerson(data.person);
    } catch (error) {
      console.error('Error fetching person:', error);
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async (passcode: string) => {
    setIsUnlocking(true);
    setError(null);

    try {
      const res = await fetch(`/api/people/${id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          passcode,
          useMaster: useMaster, 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.lockedUntil) {
          setLockoutSeconds(Math.ceil((new Date(data.lockedUntil).getTime() - Date.now()) / 1000));
        }
        setRemainingAttempts(data.remainingAttempts);
        setError(data.error || 'Incorrect passcode');
        return;
      }

      // Success - store the actual person's passcode (returned from API when using master)
      // This is needed for prayer decryption
      const actualPasscode = data.passcode || passcode;
      sessionStorage.setItem(`passcode_${id}`, actualPasscode);
      router.push(`/p/${id}/prayers`);
    } catch (error) {
      console.error('Error unlocking:', error);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-center">
        <div className="animate-pulse flex flex-col items-center" style={{ gap: 'var(--space-md)' }}>
          <div 
            className="bg-[var(--border-light)] rounded-full"
            style={{ width: '80px', height: '80px' }}
          />
          <div 
            className="bg-[var(--border-light)] rounded"
            style={{ width: '100px', height: '20px' }}
          />
        </div>
      </div>
    );
  }

  if (!person) {
    return null;
  }

  return (
    <div className="lock-screen">
      <div 
        className="lock-card w-full animate-fade-in-up"
        style={{ maxWidth: '380px' }}
      >
        {/* Back navigation - Strong and clear */}
        <Link
          href="/"
          className="inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          style={{ 
            gap: 'var(--space-xs)', 
            marginBottom: 'var(--space-lg)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
          }}
        >
          <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        {/* Card 1: Identity + Input + Keypad + Unlock */}
        <div className="card card-elevated" style={{ marginBottom: 'var(--space-lg)' }}>
          {/* Identity section */}
          <div 
            className="flex flex-col items-center text-center"
            style={{ marginBottom: 'var(--space-lg)' }}
          >
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <AvatarCircle
                name={person.displayName}
                initials={person.avatarInitials || undefined}
                color={person.avatarColor || undefined}
                imagePath={person.avatarPath || undefined}
                size="lg"
                interactive={false}
              />
            </div>
            
            <h1 
              className="font-serif font-semibold text-[var(--text-primary)]"
              style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-xs)' }}
            >
              {person.displayName}
            </h1>
            
            <p 
              className="text-[var(--text-muted)] flex items-center justify-center"
              style={{ fontSize: 'var(--text-sm)', gap: '6px' }}
            >
              <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Enter passcode to view prayers
            </p>
          </div>

          {/* Passcode type toggle - Only show if master passcode is set up */}
          {hasMasterPasscode && (
            <div 
              className="flex items-center justify-center"
              style={{ 
                marginBottom: 'var(--space-lg)',
                gap: 'var(--space-xs)',
              }}
            >
              <button
                onClick={() => setUseMaster(false)}
                className="transition-all"
                style={{
                  padding: 'var(--space-xs) var(--space-md)',
                  background: !useMaster ? 'var(--accent-primary)' : 'var(--surface-secondary)',
                  color: !useMaster ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--card-radius-sm)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Personal
              </button>
              <button
                onClick={() => setUseMaster(true)}
                className="transition-all flex items-center"
                style={{
                  padding: 'var(--space-xs) var(--space-md)',
                  background: useMaster ? 'var(--accent-primary)' : 'var(--surface-secondary)',
                  color: useMaster ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--card-radius-sm)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  gap: '6px',
                }}
              >
                <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Master
              </button>
            </div>
          )}

          {/* Helper text for master passcode */}
          {useMaster && (
            <div 
              className="text-center"
              style={{ 
                marginBottom: 'var(--space-md)',
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--accent-primary-light)',
                borderRadius: 'var(--card-radius-sm)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              Enter your master passcode to unlock all profiles
            </div>
          )}

          {/* Passcode input */}
          <PasscodeInput
            onSubmit={handleUnlock}
            isLoading={isUnlocking}
            error={error}
            remainingAttempts={remainingAttempts}
            lockoutSeconds={lockoutSeconds}
            placeholder={useMaster ? "Master passcode" : "Enter passcode"}
          />
        </div>

        {/* Card 2: Verse - Muted, supportive */}
        <VerseCard verseId={person.verseId} muted />
      </div>
    </div>
  );
}
