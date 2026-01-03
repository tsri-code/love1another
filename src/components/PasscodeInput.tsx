'use client';

import { useState } from 'react';

interface PasscodeInputProps {
  onSubmit: (passcode: string) => void;
  isLoading?: boolean;
  error?: string | null;
  remainingAttempts?: number;
  lockoutSeconds?: number;
  placeholder?: string;
}

export function PasscodeInput({
  onSubmit,
  isLoading,
  error,
  remainingAttempts,
  lockoutSeconds,
  placeholder = "Enter passcode",
}: PasscodeInputProps) {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode && !isLoading && !lockoutSeconds) {
      onSubmit(passcode);
    }
  };

  const handleNumpadClick = (num: string) => {
    if (!isLoading && !lockoutSeconds) {
      setPasscode(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setPasscode(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPasscode('');
  };

  const isDisabled = isLoading || !!lockoutSeconds;

  return (
    <form onSubmit={handleSubmit}>
      {/* Passcode display */}
      <div className="relative" style={{ marginBottom: 'var(--space-md)' }}>
        <input
          type={showPasscode ? 'text' : 'password'}
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder={placeholder}
          className={`
            input input-lg text-center font-medium
            ${error ? 'input-error animate-shake' : ''}
          `}
          style={{ 
            fontSize: 'var(--text-lg)',
            fontFamily: 'var(--font-sans)',
          }}
          disabled={isDisabled}
          autoComplete="off"
          autoFocus
        />
        
        {/* Show/hide toggle */}
        <button
          type="button"
          onClick={() => setShowPasscode(!showPasscode)}
          className="icon-btn absolute top-1/2 -translate-y-1/2"
          style={{ right: 'var(--space-xs)' }}
          tabIndex={-1}
        >
          {showPasscode ? (
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div 
          className="text-center bg-[var(--error-light)] rounded-[var(--card-radius-sm)]"
          style={{ padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-md)' }}
        >
          <p className="text-[var(--error)] font-medium" style={{ fontSize: 'var(--text-sm)' }}>
            {error}
          </p>
          {remainingAttempts !== undefined && remainingAttempts > 0 && (
            <p className="text-[var(--text-muted)]" style={{ fontSize: 'var(--text-xs)', marginTop: '4px' }}>
              {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
            </p>
          )}
        </div>
      )}

      {/* Lockout message */}
      {lockoutSeconds && lockoutSeconds > 0 && (
        <div 
          className="text-center bg-[var(--warning-light)] rounded-[var(--card-radius-sm)]"
          style={{ padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-md)' }}
        >
          <p className="text-[var(--warning)] font-medium" style={{ fontSize: 'var(--text-sm)' }}>
            Too many attempts. Please wait {lockoutSeconds} seconds.
          </p>
        </div>
      )}

      {/* Numpad - Warmer styling */}
      <div 
        className="grid grid-cols-3"
        style={{ gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}
      >
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <button
            key={num}
            type="button"
            onClick={() => handleNumpadClick(num)}
            disabled={isDisabled}
            className="
              font-semibold
              bg-[var(--surface-secondary)] 
              border border-[var(--border-light)]
              rounded-[var(--card-radius-sm)]
              transition-all
              hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-medium)]
              active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            style={{ 
              height: 'var(--button-height)', 
              fontSize: 'var(--text-xl)',
            }}
          >
            {num}
          </button>
        ))}
        
        {/* Clear */}
        <button
          type="button"
          onClick={handleClear}
          disabled={isDisabled}
          className="
            font-medium text-[var(--text-muted)]
            bg-[var(--bg-secondary)]
            rounded-[var(--card-radius-sm)]
            transition-all
            hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          style={{ 
            height: 'var(--button-height)', 
            fontSize: 'var(--text-sm)',
          }}
        >
          Clear
        </button>
        
        {/* Zero */}
        <button
          type="button"
          onClick={() => handleNumpadClick('0')}
          disabled={isDisabled}
          className="
            font-semibold
            bg-[var(--surface-secondary)] 
            border border-[var(--border-light)]
            rounded-[var(--card-radius-sm)]
            transition-all
            hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-medium)]
            active:scale-95
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          style={{ 
            height: 'var(--button-height)', 
            fontSize: 'var(--text-xl)',
          }}
        >
          0
        </button>
        
        {/* Backspace */}
        <button
          type="button"
          onClick={handleBackspace}
          disabled={isDisabled}
          className="
            text-[var(--text-muted)]
            bg-[var(--bg-secondary)]
            rounded-[var(--card-radius-sm)]
            transition-all
            hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]
            flex items-center justify-center
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          style={{ height: 'var(--button-height)' }}
        >
          <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
          </svg>
        </button>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={!passcode || isDisabled}
        className="btn btn-primary btn-lg btn-full"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin" style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Unlocking...
          </>
        ) : (
          <>
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Unlock
          </>
        )}
      </button>
    </form>
  );
}
