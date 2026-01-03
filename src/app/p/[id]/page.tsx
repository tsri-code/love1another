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
  const [hasTouchId, setHasTouchId] = useState(false);
  const [isTouchIdLoading, setIsTouchIdLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchPerson();
    checkTouchIdAvailability();
  }, [id]);

  const checkTouchIdAvailability = async () => {
    try {
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) return;
      
      // Check if platform authenticator is available
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) return;
      
      // Check if credentials are registered (via GET request to biometric endpoint)
      const res = await fetch(`/api/people/${id}/biometric`);
      if (res.ok) {
        setHasTouchId(true);
      }
    } catch {
      // Touch ID not available, that's okay
    }
  };

  const handleTouchIdUnlock = async () => {
    setIsTouchIdLoading(true);
    setError(null);

    try {
      // Get authentication options
      const optionsRes = await fetch(`/api/people/${id}/biometric`);
      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        throw new Error(data.error || 'Failed to get Touch ID options');
      }
      
      const { challengeId, options } = await optionsRes.json();
      
      // Convert challenge from base64url to ArrayBuffer
      const challengeBuffer = Uint8Array.from(
        atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')),
        c => c.charCodeAt(0)
      );
      
      // Convert allowCredentials
      const allowCredentials = options.allowCredentials.map((cred: { id: string; type: string; transports: string[] }) => ({
        ...cred,
        id: Uint8Array.from(
          atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')),
          c => c.charCodeAt(0)
        ),
      }));
      
      // Request authentication
      const credential = await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: challengeBuffer,
          allowCredentials,
        },
      }) as PublicKeyCredential;
      
      if (!credential) {
        throw new Error('Touch ID authentication was cancelled');
      }
      
      // Send credential to server for verification
      const authRes = await fetch(`/api/people/${id}/biometric`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          credential: {
            id: credential.id,
            rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
            type: credential.type,
            response: {
              authenticatorData: btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAssertionResponse).authenticatorData))),
              clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
              signature: btoa(String.fromCharCode(...new Uint8Array((credential.response as AuthenticatorAssertionResponse).signature))),
            },
          },
        }),
      });
      
      const authData = await authRes.json();
      
      if (!authRes.ok) {
        throw new Error(authData.error || 'Touch ID verification failed');
      }
      
      // Now we need to create a session by calling the unlock endpoint with the passcode
      const unlockRes = await fetch(`/api/people/${id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: authData.passcode }),
      });
      
      if (!unlockRes.ok) {
        throw new Error('Failed to create session');
      }
      
      // Success! Store passcode and redirect
      sessionStorage.setItem(`passcode_${id}`, authData.passcode);
      router.push(`/p/${id}/prayers`);
    } catch (err) {
      console.error('Touch ID error:', err);
      setError(err instanceof Error ? err.message : 'Touch ID failed. Please use passcode.');
    } finally {
      setIsTouchIdLoading(false);
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
        body: JSON.stringify({ passcode }),
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

      // Success - store passcode for prayer operations and redirect
      sessionStorage.setItem(`passcode_${id}`, passcode);
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
    <div className="page-center">
      <div 
        className="w-full animate-fade-in-up"
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

          {/* Touch ID button */}
          {hasTouchId && (
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <button
                onClick={handleTouchIdUnlock}
                disabled={isTouchIdLoading || !!lockoutSeconds}
                className="w-full flex items-center justify-center transition-all"
                style={{
                  gap: 'var(--space-sm)',
                  padding: 'var(--space-md) var(--space-lg)',
                  background: 'var(--accent-gold)',
                  color: 'var(--accent-gold-text)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  cursor: isTouchIdLoading || !!lockoutSeconds ? 'not-allowed' : 'pointer',
                  opacity: isTouchIdLoading || !!lockoutSeconds ? 0.6 : 1,
                }}
              >
                {isTouchIdLoading ? (
                  <>
                    <svg className="animate-spin" style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Authenticating...
                  </>
                ) : (
                  <>
                    {/* Fingerprint icon */}
                    <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                    Unlock with Touch ID
                  </>
                )}
              </button>
              
              <div 
                className="text-center"
                style={{ 
                  marginTop: 'var(--space-md)',
                  color: 'var(--text-muted)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                or enter passcode below
              </div>
            </div>
          )}

          {/* Passcode input */}
          <PasscodeInput
            onSubmit={handleUnlock}
            isLoading={isUnlocking}
            error={error}
            remainingAttempts={remainingAttempts}
            lockoutSeconds={lockoutSeconds}
          />
        </div>

        {/* Card 2: Verse - Muted, supportive */}
        <VerseCard verseId={person.verseId} muted />
      </div>
    </div>
  );
}
