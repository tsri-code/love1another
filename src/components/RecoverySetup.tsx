"use client";

import { useState } from "react";
import { Alert, AlertDescription, WarningIcon } from "@/components/ui/alert";

interface RecoverySetupProps {
  recoveryCode: string;
  onComplete: () => void;
  onCancel?: () => void;
}

/**
 * Modal component for setting up recovery code during initial encryption setup
 * Shows the 6-word recovery code and requires user to confirm they've saved it
 */
export function RecoverySetup({
  recoveryCode,
  onComplete,
  onCancel,
}: RecoverySetupProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = recoveryCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const content = `Love1Another Recovery Code
============================
Save this code in a safe place. You will need it to restore 
your encrypted messages if you forget your password.

Your Recovery Code:
${recoveryCode}

============================
Keep this file secure and private.
Generated: ${new Date().toISOString()}`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "love1another-recovery-code.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl p-6 md:p-8"
        style={{
          backgroundColor: "var(--surface-card)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
            }}
          >
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2
            className="text-xl md:text-2xl font-semibold mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Protect Your Messages
          </h2>
          <p
            className="text-sm md:text-base"
            style={{ color: "var(--text-secondary)" }}
          >
            Save this recovery code. You will need it to restore your encrypted messages if you forget your password.
          </p>
        </div>

        {/* Recovery Code Display */}
        <div
          className="rounded-xl p-4 mb-4 text-center"
          style={{
            backgroundColor: "var(--surface-elevated)",
            border: "2px dashed var(--border-medium)",
          }}
        >
          <p
            className="text-lg md:text-xl font-mono font-medium tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            {recoveryCode}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all"
            style={{
              backgroundColor: "var(--surface-elevated)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-light)",
            }}
          >
            {copied ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all"
            style={{
              backgroundColor: "var(--surface-elevated)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-light)",
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
        </div>

        {/* Warning */}
        <Alert variant="warning" icon={<WarningIcon />} className="mb-6">
          <AlertDescription>
            Write this down and store it safely. You will not be able to see it again after closing this screen.
          </AlertDescription>
        </Alert>

        {/* Confirmation Checkbox */}
        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 w-5 h-5 rounded"
            style={{
              accentColor: "var(--accent-primary)",
            }}
          />
          <span
            className="text-sm md:text-base"
            style={{ color: "var(--text-primary)" }}
          >
            I have saved my recovery code in a safe place
          </span>
        </label>

        {/* Continue Button */}
        <div className="flex gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-xl font-medium transition-all"
              style={{
                backgroundColor: "var(--surface-elevated)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-light)",
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={onComplete}
            disabled={!confirmed}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
              !confirmed ? "opacity-50 cursor-not-allowed" : ""
            }`}
            style={{
              background: confirmed
                ? "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)"
                : "var(--surface-elevated)",
              color: confirmed ? "white" : "var(--text-muted)",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

interface RecoveryRestoreProps {
  onRestore: (recoveryCode: string) => Promise<void>;
  onSkip: () => void;
  isLoading?: boolean;
  error?: string;
}

/**
 * Component for entering recovery code after password reset
 */
export function RecoveryRestore({
  onRestore,
  onSkip,
  isLoading = false,
  error,
}: RecoveryRestoreProps) {
  const [recoveryCode, setRecoveryCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryCode.trim()) {
      await onRestore(recoveryCode.trim().toLowerCase());
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
          style={{
            background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
          }}
        >
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <h2
          className="text-xl md:text-2xl font-semibold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Restore Your Messages
        </h2>
        <p
          className="text-sm md:text-base"
          style={{ color: "var(--text-secondary)" }}
        >
          Enter the 6-word recovery code you saved when you set up encryption.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Recovery Code Input */}
        <div className="mb-4">
          <textarea
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            placeholder="word1 word2 word3 word4 word5 word6"
            rows={2}
            className="w-full px-4 py-3 rounded-xl text-center font-mono"
            style={{
              backgroundColor: "var(--surface-elevated)",
              color: "var(--text-primary)",
              border: `1px solid ${error ? "var(--error)" : "var(--border-light)"}`,
            }}
            disabled={isLoading}
          />
          {error && (
            <p className="mt-2 text-sm text-center" style={{ color: "var(--error)" }}>
              {error}
            </p>
          )}
        </div>

        {/* Restore Button */}
        <button
          type="submit"
          disabled={!recoveryCode.trim() || isLoading}
          className={`w-full py-3 px-4 rounded-xl font-medium transition-all mb-4 ${
            !recoveryCode.trim() || isLoading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          style={{
            background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
            color: "white",
          }}
        >
          {isLoading ? "Restoring..." : "Restore"}
        </button>

        {/* Skip Button */}
        <button
          type="button"
          onClick={onSkip}
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-xl font-medium transition-all text-center"
          style={{
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
          }}
        >
          Skip - I lost my recovery code
        </button>
        <p
          className="text-xs text-center mt-2"
          style={{ color: "var(--text-muted)" }}
        >
          You will lose access to previously encrypted messages
        </p>
      </form>
    </div>
  );
}

interface ViewRecoveryCodeProps {
  recoveryCode: string;
  onClose: () => void;
}

/**
 * Component for viewing recovery code in settings (after step-up verification)
 */
export function ViewRecoveryCode({ recoveryCode, onClose }: ViewRecoveryCodeProps) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);

  // Auto-close after 60 seconds
  useState(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = recoveryCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{
          backgroundColor: "var(--surface-card)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="text-center mb-4">
          <h3
            className="text-lg font-semibold mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Your Recovery Code
          </h3>
          <p
            className="text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            This will hide automatically in {timeLeft} seconds
          </p>
        </div>

        <div
          className="rounded-xl p-4 mb-4 text-center"
          style={{
            backgroundColor: "var(--surface-elevated)",
            border: "2px dashed var(--border-medium)",
          }}
        >
          <p
            className="text-lg font-mono font-medium tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            {recoveryCode}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium"
            style={{
              backgroundColor: "var(--surface-elevated)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-light)",
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl font-medium"
            style={{
              background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
              color: "white",
            }}
          >
            Hide
          </button>
        </div>
      </div>
    </div>
  );
}
