"use client";

import { useState, useEffect } from "react";
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
  const [copied, setCopied] = useState(false);
  const [confirmationWord, setConfirmationWord] = useState("");

  const words = recoveryCode.split(" ");
  const lastWord = words[words.length - 1]?.toLowerCase() || "";
  const isConfirmed = confirmationWord.toLowerCase().trim() === lastWord;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          maxHeight: "90vh",
          backgroundColor: "var(--surface-primary)",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "24px 24px 16px",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1 }}>
            <h3
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "4px",
              }}
            >
              Save Your Recovery Code
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              This is your only way to restore encrypted prayers and messages if you forget your password.
            </p>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                padding: "8px",
                marginLeft: "16px",
                marginTop: "-4px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                borderRadius: "8px",
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 24px 24px",
          }}
        >
          {/* Critical Warning */}
          <div
            style={{
              padding: "14px",
              marginBottom: "20px",
              borderRadius: "12px",
              backgroundColor: "var(--error-light)",
              border: "1px solid var(--error)",
            }}
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <svg
                style={{ width: "20px", height: "20px", flexShrink: 0, color: "var(--error)" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--error)", marginBottom: "2px" }}>
                  Important: Save this code securely
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  If you lose both your password AND this code, your encrypted data is permanently inaccessible.
                </p>
              </div>
            </div>
          </div>

          {/* Recovery Code Display */}
          <div
            style={{
              padding: "20px",
              marginBottom: "16px",
              backgroundColor: "var(--surface-elevated)",
              border: "2px dashed var(--border-medium)",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "0.05em",
                wordSpacing: "0.15em",
                lineHeight: 1.5,
              }}
            >
              {recoveryCode}
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <button
              onClick={handleCopy}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px 16px",
                fontSize: "14px",
                fontWeight: 600,
                borderRadius: "10px",
                backgroundColor: copied ? "var(--success-light)" : "var(--surface-elevated)",
                color: copied ? "var(--success)" : "var(--text-primary)",
                border: `1px solid ${copied ? "var(--success)" : "var(--border-medium)"}`,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {copied ? (
                <>
                  <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px 16px",
                fontSize: "14px",
                fontWeight: 600,
                borderRadius: "10px",
                backgroundColor: "var(--surface-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-medium)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {/* Confirmation */}
          <div style={{ marginTop: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--text-primary)",
                marginBottom: "8px",
              }}
            >
              To confirm you saved it, type the <strong>LAST word</strong> of your recovery code:
            </label>
            <input
              type="text"
              value={confirmationWord}
              onChange={(e) => setConfirmationWord(e.target.value)}
              placeholder="Type last word..."
              style={{
                width: "100%",
                padding: "14px 16px",
                fontSize: "15px",
                fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                textAlign: "center",
                borderRadius: "10px",
                backgroundColor: "var(--surface-elevated)",
                color: "var(--text-primary)",
                border: `1px solid ${isConfirmed ? "var(--success)" : "var(--border-medium)"}`,
                transition: "border-color 0.2s ease",
              }}
            />
            {confirmationWord && !isConfirmed && (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", marginTop: "6px" }}>
                Check your recovery code and try again
              </p>
            )}
            {isConfirmed && (
              <p style={{ fontSize: "13px", color: "var(--success)", textAlign: "center", marginTop: "6px" }}>
                Confirmed! Click Continue to proceed.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "16px 24px 24px",
            borderTop: "1px solid var(--border-light)",
            flexShrink: 0,
          }}
        >
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: "14px 20px",
                fontSize: "15px",
                fontWeight: 500,
                backgroundColor: "transparent",
                border: "1px solid var(--border-medium)",
                borderRadius: "10px",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={onComplete}
            disabled={!isConfirmed}
            style={{
              flex: 1,
              padding: "14px 20px",
              fontSize: "15px",
              fontWeight: 600,
              backgroundColor: "var(--accent-primary)",
              border: "none",
              borderRadius: "10px",
              color: "white",
              cursor: isConfirmed ? "pointer" : "not-allowed",
              opacity: isConfirmed ? 1 : 0.5,
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
  useEffect(() => {
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
  }, [onClose]);

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

  const progress = (timeLeft / 60) * 100;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "var(--surface-primary)",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "24px 24px 16px",
          }}
        >
          <div style={{ flex: 1 }}>
            <h3
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "4px",
              }}
            >
              Your Recovery Code
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              Keep this code safe. It&apos;s your backup key to encrypted content.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "8px",
              marginLeft: "16px",
              marginTop: "-4px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              borderRadius: "8px",
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "8px 24px 24px" }}>
          {/* Timer indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              marginBottom: "20px",
              padding: "10px 14px",
              borderRadius: "10px",
              backgroundColor: timeLeft <= 15 ? "var(--error-light)" : "var(--surface-elevated)",
              border: `1px solid ${timeLeft <= 15 ? "var(--error)" : "var(--border-light)"}`,
              transition: "all 0.3s ease",
            }}
          >
            <svg
              style={{ width: "18px", height: "18px", color: timeLeft <= 15 ? "var(--error)" : "var(--text-muted)", flexShrink: 0 }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: timeLeft <= 15 ? "var(--error)" : "var(--text-secondary)",
              }}
            >
              Auto-hiding in {timeLeft}s
            </span>
            <div
              style={{
                flex: 1,
                height: "4px",
                backgroundColor: "var(--border-light)",
                borderRadius: "2px",
                overflow: "hidden",
                maxWidth: "60px",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  backgroundColor: timeLeft <= 15 ? "var(--error)" : "var(--accent-primary)",
                  transition: "width 1s linear",
                }}
              />
            </div>
          </div>

          {/* Recovery Code Display */}
          <div
            style={{
              padding: "20px",
              backgroundColor: "var(--surface-elevated)",
              border: "2px dashed var(--border-medium)",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "0.05em",
                wordSpacing: "0.15em",
                lineHeight: 1.5,
              }}
            >
              {recoveryCode}
            </p>
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            style={{
              width: "100%",
              marginTop: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "14px 16px",
              fontSize: "15px",
              fontWeight: 600,
              borderRadius: "10px",
              backgroundColor: copied ? "var(--success-light)" : "var(--surface-elevated)",
              color: copied ? "var(--success)" : "var(--text-primary)",
              border: `1px solid ${copied ? "var(--success)" : "var(--border-medium)"}`,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {copied ? (
              <>
                <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied to Clipboard
              </>
            ) : (
              <>
                <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Recovery Code
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px 24px",
            borderTop: "1px solid var(--border-light)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "14px 20px",
              fontSize: "15px",
              fontWeight: 600,
              backgroundColor: "var(--accent-primary)",
              border: "none",
              borderRadius: "10px",
              color: "white",
              cursor: "pointer",
            }}
          >
            Hide Recovery Code
          </button>
        </div>
      </div>
    </div>
  );
}
