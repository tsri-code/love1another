'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';

interface EntityWithPasscode {
  id: string;
  displayName: string;
  entityType: 'person' | 'group' | 'link';
  avatarInitials: string | null;
  avatarColor: string | null;
  passcode: string | null;
  createdAt: string;
}

type ViewState = 'loading' | 'setup' | 'unlock' | 'success' | 'passwords';

export default function PasswordsPage() {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [entities, setEntities] = useState<EntityWithPasscode[]>([]);
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasscodes, setShowPasscodes] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Reset password modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Check setup status and try to load passwords
  const checkStatus = useCallback(async () => {
    try {
      const setupRes = await fetch('/api/passwords/setup');
      const setupData = await setupRes.json();
      
      if (!setupData.isSetUp) {
        setViewState('setup');
        return;
      }
      
      const passwordsRes = await fetch('/api/passwords');
      if (passwordsRes.ok) {
        const data = await passwordsRes.json();
        setEntities(data.entities);
        setViewState('passwords');
      } else {
        setViewState('unlock');
      }
    } catch (err) {
      console.error('Error checking status:', err);
      setError('Failed to load');
      setViewState('unlock');
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Setup master passcode
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (passcode.length < 6) {
      setError('Passcode must be at least 6 characters');
      return;
    }
    
    if (passcode !== confirmPasscode) {
      setError('Passcodes do not match');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch('/api/passwords/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Setup failed');
      }
      
      const unlockRes = await fetch('/api/passwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      
      if (unlockRes.ok) {
        setViewState('success');
        setTimeout(() => checkStatus(), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
      setPasscode('');
      setConfirmPasscode('');
    }
  };

  // Unlock with passcode
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/passwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid passcode');
      }
      
      setViewState('success');
      setTimeout(() => checkStatus(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed');
    } finally {
      setLoading(false);
      setPasscode('');
    }
  };

  // Reset master password
  const handleResetPassword = async () => {
    setError('');
    
    if (!currentPassword) {
      setError('Current password is required');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch('/api/passwords/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          oldPasscode: currentPassword,
          passcode: newPassword 
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Reset failed');
      }
      
      setResetSuccess(true);
      setTimeout(() => {
        setShowResetModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setResetSuccess(false);
        setError('');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  // Lock
  const handleLock = async () => {
    await fetch('/api/passwords', { method: 'DELETE' });
    setEntities([]);
    setViewState('unlock');
  };

  // Toggle passcode visibility
  const togglePasscode = (id: string) => {
    setShowPasscodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Copy passcode
  const copyPasscode = async (id: string, passcodeValue: string) => {
    await navigator.clipboard.writeText(passcodeValue);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Loading state
  if (viewState === 'loading') {
    return (
      <div className="page-center">
        <div className="flex flex-col items-center" style={{ gap: 'var(--space-md)' }}>
          <div 
            className="rounded-full border-4 border-t-transparent animate-spin"
            style={{ 
              width: '48px', 
              height: '48px',
              borderColor: 'var(--accent-primary)',
              borderTopColor: 'transparent',
            }} 
          />
          <p className="text-[var(--text-muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  // Success animation
  if (viewState === 'success') {
    return (
      <div className="page-center">
        <div className="flex flex-col items-center text-center animate-scale-in" style={{ gap: 'var(--space-md)' }}>
          <div 
            className="rounded-full flex items-center justify-center"
            style={{ 
              width: '88px', 
              height: '88px',
              background: 'var(--success-light)',
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p 
            className="font-semibold"
            style={{ fontSize: 'var(--text-lg)', color: 'var(--success)' }}
          >
            Unlocked
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <AppHeader 
        showBack 
        backHref="/" 
        title="Passwords"
        actions={
          viewState === 'passwords' ? (
            <button
              onClick={handleLock}
              className="btn btn-secondary btn-sm flex items-center"
              style={{ gap: 'var(--space-xs)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Lock
            </button>
          ) : undefined
        }
      />

      <main className="flex-1">
        <div className="container" style={{ paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-2xl)' }}>
          
          {/* Setup View */}
          {viewState === 'setup' && (
            <div className="flex flex-col items-center">
              <div 
                className="card card-elevated w-full animate-fade-in"
                style={{ maxWidth: '420px', padding: 'var(--space-xl)' }}
              >
                {/* Icon */}
                <div className="text-center" style={{ marginBottom: 'var(--space-lg)' }}>
                  <div 
                    className="inline-flex items-center justify-center rounded-2xl"
                    style={{ 
                      width: '80px', 
                      height: '80px',
                      background: 'var(--bg-secondary)',
                      marginBottom: 'var(--space-md)',
                    }}
                  >
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      <circle cx="12" cy="16" r="1" fill="var(--accent-primary)"/>
                    </svg>
                  </div>
                  <h1 
                    className="font-serif font-semibold"
                    style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)', marginBottom: 'var(--space-xs)' }}
                  >
                    Set Up Master Password
                  </h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    This password protects access to all your stored passcodes
                  </p>
                </div>
                
                {/* Form */}
                <form onSubmit={handleSetup} className="space-y-4">
                  <div>
                    <label 
                      className="block font-medium"
                      style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}
                    >
                      Master Password
                    </label>
                    <input
                      type="password"
                      value={passcode}
                      onChange={e => setPasscode(e.target.value)}
                      className="input"
                      placeholder="Minimum 6 characters"
                      autoFocus
                    />
                  </div>
                  
                  <div>
                    <label 
                      className="block font-medium"
                      style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}
                    >
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPasscode}
                      onChange={e => setConfirmPasscode(e.target.value)}
                      className="input"
                      placeholder="Re-enter password"
                    />
                  </div>
                  
                  {error && (
                    <div 
                      className="flex items-center rounded-xl"
                      style={{ 
                        gap: 'var(--space-sm)', 
                        padding: 'var(--space-sm) var(--space-md)',
                        background: 'var(--error-light)', 
                        color: 'var(--error)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      {error}
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={loading || passcode.length < 6}
                    className="btn btn-primary w-full"
                    style={{ marginTop: 'var(--space-md)' }}
                  >
                    {loading ? 'Setting up...' : 'Create Master Password'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Unlock View */}
          {viewState === 'unlock' && (
            <div className="flex flex-col items-center">
              <div 
                className="card card-elevated w-full animate-fade-in"
                style={{ maxWidth: '420px', padding: 'var(--space-xl)' }}
              >
                {/* Icon */}
                <div className="text-center" style={{ marginBottom: 'var(--space-lg)' }}>
                  <div 
                    className="inline-flex items-center justify-center rounded-2xl"
                    style={{ 
                      width: '80px', 
                      height: '80px',
                      background: 'var(--bg-secondary)',
                      marginBottom: 'var(--space-md)',
                    }}
                  >
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <h1 
                    className="font-serif font-semibold"
                    style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)', marginBottom: 'var(--space-xs)' }}
                  >
                    Unlock Passwords
                  </h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    Enter your master password
                  </p>
                </div>
                
                {/* Passcode Form */}
                <form onSubmit={handleUnlock} className="space-y-4">
                  <input
                    type="password"
                    value={passcode}
                    onChange={e => setPasscode(e.target.value)}
                    className="input"
                    placeholder="Enter master password"
                    autoFocus
                  />
                  
                  {error && (
                    <div 
                      className="flex items-center rounded-xl"
                      style={{ 
                        gap: 'var(--space-sm)', 
                        padding: 'var(--space-sm) var(--space-md)',
                        background: 'var(--error-light)', 
                        color: 'var(--error)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      {error}
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={loading || !passcode}
                    className="btn btn-primary w-full"
                  >
                    {loading ? 'Unlocking...' : 'Unlock'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Passwords View */}
          {viewState === 'passwords' && (
            <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
              {/* Title */}
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <h1 
                  className="font-serif font-semibold"
                  style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)', marginBottom: 'var(--space-xs)' }}
                >
                  Saved Passwords
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  {entities.length} {entities.length === 1 ? 'passcode' : 'passcodes'} stored
                </p>
              </div>

              {/* Error display */}
              {error && (
                <div 
                  className="flex items-center rounded-xl"
                  style={{ 
                    gap: 'var(--space-sm)', 
                    padding: 'var(--space-sm) var(--space-md)',
                    background: 'var(--error-light)', 
                    color: 'var(--error)',
                    fontSize: 'var(--text-sm)',
                    marginBottom: 'var(--space-lg)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                  <button 
                    onClick={() => setError('')} 
                    className="ml-auto text-[var(--error)] hover:opacity-70"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Password List */}
              {entities.length === 0 ? (
                <div className="card text-center" style={{ padding: 'var(--space-2xl)' }}>
                  <div 
                    className="inline-flex items-center justify-center rounded-full"
                    style={{ 
                      width: '64px', 
                      height: '64px',
                      background: 'var(--bg-secondary)',
                      marginBottom: 'var(--space-md)',
                    }}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <h3 
                    className="font-medium"
                    style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-xs)' }}
                  >
                    No people yet
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    Passcodes will appear here when you add people to your prayer list
                  </p>
                  <Link href="/add" className="btn btn-primary" style={{ marginTop: 'var(--space-lg)' }}>
                    Add Your First Person
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {entities.map(entity => (
                    <div key={entity.id} className="card" style={{ padding: 'var(--space-md)' }}>
                      <div className="flex items-center" style={{ gap: 'var(--space-md)' }}>
                        {/* Avatar */}
                        <div 
                          className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                          style={{ 
                            width: '48px', 
                            height: '48px',
                            fontSize: 'var(--text-sm)',
                            background: entity.avatarColor || 'var(--accent-primary)',
                          }}
                        >
                          {entity.avatarInitials || entity.displayName.substring(0, 2).toUpperCase()}
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center" style={{ gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                            <span 
                              className="font-medium truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {entity.displayName}
                            </span>
                            {entity.entityType !== 'person' && (
                              <span className="badge">{entity.entityType}</span>
                            )}
                          </div>
                          
                          {/* Passcode */}
                          <div className="flex items-center" style={{ gap: 'var(--space-xs)' }}>
                            <code 
                              className="font-mono rounded-lg"
                              style={{ 
                                fontSize: 'var(--text-sm)',
                                padding: 'var(--space-xs) var(--space-sm)',
                                background: 'var(--bg-secondary)', 
                                color: 'var(--accent-primary)',
                              }}
                            >
                              {showPasscodes[entity.id] ? (entity.passcode || '—') : '••••••'}
                            </code>
                            
                            <button
                              onClick={() => togglePasscode(entity.id)}
                              className="icon-btn"
                              title={showPasscodes[entity.id] ? 'Hide' : 'Show'}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                {showPasscodes[entity.id] ? (
                                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/>
                                ) : (
                                  <>
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                  </>
                                )}
                              </svg>
                            </button>
                            
                            {entity.passcode && (
                              <button
                                onClick={() => copyPasscode(entity.id, entity.passcode!)}
                                className="icon-btn"
                                title="Copy"
                              >
                                {copiedId === entity.id ? (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                                    <path d="M20 6L9 17l-5-5"/>
                                  </svg>
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reset Master Password Section */}
              <div 
                className="card"
                style={{ 
                  marginTop: 'var(--space-xl)',
                  padding: 'var(--space-md)',
                  border: '1px solid var(--border-medium)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center" style={{ gap: 'var(--space-md)' }}>
                    <div 
                      className="rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ 
                        width: '44px', 
                        height: '44px',
                        background: 'var(--bg-secondary)',
                      }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                        <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        Master Password
                      </p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        Change your master password
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowResetModal(true);
                      setError('');
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmNewPassword('');
                      setResetSuccess(false);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Reset Password Modal */}
      {showResetModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ padding: 'var(--space-md)' }}
        >
          <div 
            className="card card-elevated w-full animate-scale-in"
            style={{ maxWidth: '400px', padding: 'var(--space-xl)' }}
          >
            {resetSuccess ? (
              <div className="text-center">
                <div 
                  className="inline-flex items-center justify-center rounded-full"
                  style={{ 
                    width: '72px', 
                    height: '72px',
                    background: 'var(--success-light)',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2 
                  className="font-serif font-semibold"
                  style={{ fontSize: 'var(--text-xl)', color: 'var(--success)' }}
                >
                  Password Updated!
                </h2>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="text-center" style={{ marginBottom: 'var(--space-lg)' }}>
                  <div 
                    className="inline-flex items-center justify-center rounded-full"
                    style={{ 
                      width: '72px', 
                      height: '72px',
                      background: 'var(--warning-light)',
                      marginBottom: 'var(--space-md)',
                    }}
                  >
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.5">
                      <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <h2 
                    className="font-serif font-semibold"
                    style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)', marginBottom: 'var(--space-xs)' }}
                  >
                    Reset Master Password
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    Enter your current password to verify it's you
                  </p>
                </div>

                {/* Form */}
                <div className="space-y-4">
                  <div>
                    <label 
                      className="block font-medium"
                      style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}
                    >
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="input"
                      placeholder="Enter current password"
                      autoFocus
                    />
                  </div>
                  
                  <div>
                    <label 
                      className="block font-medium"
                      style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}
                    >
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="input"
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                  
                  <div>
                    <label 
                      className="block font-medium"
                      style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}
                    >
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={e => setConfirmNewPassword(e.target.value)}
                      className="input"
                      placeholder="Re-enter new password"
                    />
                  </div>
                  
                  {error && (
                    <div 
                      className="flex items-center rounded-xl"
                      style={{ 
                        gap: 'var(--space-sm)', 
                        padding: 'var(--space-sm) var(--space-md)',
                        background: 'var(--error-light)', 
                        color: 'var(--error)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      {error}
                    </div>
                  )}
                  
                  <div className="flex" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                    <button
                      onClick={() => {
                        setShowResetModal(false);
                        setError('');
                      }}
                      className="btn btn-secondary flex-1"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleResetPassword}
                      disabled={loading || !currentPassword || !newPassword || !confirmNewPassword}
                      className="btn btn-primary flex-1"
                    >
                      {loading ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
