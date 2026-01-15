"use client";

import { useState } from "react";
import { performMigration } from "@/lib/migration-crypto";

interface MigrationSetupProps {
  userId: string;
  password: string;
  onComplete: () => void;
  onError: (error: string) => void;
}

/**
 * MigrationSetup Component
 *
 * Guides existing users through the migration from legacy password-derived
 * encryption to the new DEK-based envelope encryption with recovery codes.
 *
 * The flow is:
 * 1. Explain what's happening
 * 2. User clicks "Set Up"
 * 3. Migration runs (re-encrypts all data)
 * 4. Show recovery code
 * 5. User confirms they saved it
 * 6. Migration complete
 */
export function MigrationSetup({
  userId,
  password,
  onComplete,
  onError,
}: MigrationSetupProps) {
  const [step, setStep] = useState<
    "intro" | "migrating" | "recovery" | "confirm"
  >("intro");
  const [recoveryCode, setRecoveryCode] = useState<string>("");
  const [migratedCount, setMigratedCount] = useState({ profiles: 0, links: 0 });
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleStartMigration = async () => {
    setStep("migrating");

    try {
      const result = await performMigration(userId, password);

      if (!result.success) {
        onError(result.error || "Migration failed");
        setStep("intro");
        return;
      }

      setRecoveryCode(result.recoveryCode || "");
      setMigratedCount({
        profiles: result.migratedProfiles || 0,
        links: result.migratedLinks || 0,
      });
      setStep("recovery");
    } catch (error) {
      console.error("Migration error:", error);
      onError(
        error instanceof Error ? error.message : "Migration failed unexpectedly"
      );
      setStep("intro");
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
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

  const handleDownloadCode = () => {
    const content = `Love1Another Recovery Code
========================

Your 6-word recovery code:
${recoveryCode}

IMPORTANT:
- Store this code in a safe place (password manager, written down, etc.)
- You will need this code if you ever forget your password
- Without this code, you cannot recover your encrypted prayers after a password reset
- Do not share this code with anyone

Generated: ${new Date().toISOString()}
`;

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

  const handleConfirmComplete = () => {
    if (!confirmChecked) return;
    setStep("confirm");
    onComplete();
  };

  // Intro step - explain what's happening
  if (step === "intro") {
    return (
      <div className="card" style={{ maxWidth: "500px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-sm)",
            }}
          >
            <span style={{ fontSize: "24px" }}>🔐</span>
            <h2
              style={{
                margin: 0,
                fontSize: "var(--font-lg)",
                color: "var(--text-primary)",
              }}
            >
              Encryption Upgrade
            </h2>
          </div>

          <p
            style={{
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            We&apos;re upgrading your account to use a more secure encryption
            system that includes a <strong>recovery code</strong>.
          </p>

          <div
            style={{
              background: "var(--bg-secondary)",
              padding: "var(--space-md)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <h4
              style={{
                margin: "0 0 var(--space-sm) 0",
                color: "var(--text-primary)",
                fontSize: "var(--font-sm)",
              }}
            >
              What this means:
            </h4>
            <ul
              style={{
                margin: 0,
                paddingLeft: "var(--space-md)",
                color: "var(--text-secondary)",
                fontSize: "var(--font-sm)",
                lineHeight: 1.6,
              }}
            >
              <li>Your prayers remain end-to-end encrypted</li>
              <li>You&apos;ll get a 6-word recovery code to save</li>
              <li>If you forget your password, use the code to recover access</li>
              <li>This is a one-time setup that takes a few seconds</li>
            </ul>
          </div>

          <button
            className="btn-primary"
            onClick={handleStartMigration}
            style={{ width: "100%", marginTop: "var(--space-sm)" }}
          >
            Set Up Recovery Code
          </button>
        </div>
      </div>
    );
  }

  // Migrating step - show progress
  if (step === "migrating") {
    return (
      <div className="card" style={{ maxWidth: "500px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-md)",
            padding: "var(--space-lg) 0",
          }}
        >
          <div
            className="animate-pulse"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "var(--accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "24px" }}>🔄</span>
          </div>
          <h3
            style={{
              margin: 0,
              color: "var(--text-primary)",
              fontSize: "var(--font-md)",
            }}
          >
            Setting up encryption...
          </h3>
          <p
            style={{
              margin: 0,
              color: "var(--text-secondary)",
              fontSize: "var(--font-sm)",
              textAlign: "center",
            }}
          >
            This may take a few moments.
            <br />
            Please don&apos;t close this page.
          </p>
        </div>
      </div>
    );
  }

  // Recovery step - show the recovery code
  if (step === "recovery") {
    return (
      <div className="card" style={{ maxWidth: "500px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-sm)",
            }}
          >
            <span style={{ fontSize: "24px" }}>✅</span>
            <h2
              style={{
                margin: 0,
                fontSize: "var(--font-lg)",
                color: "var(--text-primary)",
              }}
            >
              Save Your Recovery Code
            </h2>
          </div>

          {(migratedCount.profiles > 0 || migratedCount.links > 0) && (
            <p
              style={{
                color: "var(--success)",
                fontSize: "var(--font-sm)",
                margin: 0,
              }}
            >
              ✓ Successfully upgraded{" "}
              {migratedCount.profiles > 0 &&
                `${migratedCount.profiles} profile${migratedCount.profiles > 1 ? "s" : ""}`}
              {migratedCount.profiles > 0 && migratedCount.links > 0 && " and "}
              {migratedCount.links > 0 &&
                `${migratedCount.links} link${migratedCount.links > 1 ? "s" : ""}`}
            </p>
          )}

          <div
            style={{
              background: "var(--bg-secondary)",
              border: "2px dashed var(--accent-primary)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-lg)",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: "0 0 var(--space-sm) 0",
                color: "var(--text-secondary)",
                fontSize: "var(--font-xs)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Your 6-Word Recovery Code
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "var(--font-lg)",
                fontWeight: 600,
                color: "var(--text-primary)",
                fontFamily: "monospace",
                wordBreak: "break-word",
              }}
            >
              {recoveryCode}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "var(--space-sm)",
            }}
          >
            <button
              className="btn-secondary"
              onClick={handleCopyCode}
              style={{ flex: 1 }}
            >
              {copied ? "✓ Copied!" : "Copy Code"}
            </button>
            <button
              className="btn-secondary"
              onClick={handleDownloadCode}
              style={{ flex: 1 }}
            >
              Download
            </button>
          </div>

          <div
            style={{
              background: "rgba(255, 193, 7, 0.1)",
              border: "1px solid rgba(255, 193, 7, 0.3)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-md)",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "var(--text-primary)",
                fontSize: "var(--font-sm)",
                lineHeight: 1.6,
              }}
            >
              ⚠️ <strong>Important:</strong> Store this code somewhere safe
              (password manager, written down, etc.). You will need it if you
              ever forget your password. Without this code, you cannot recover
              your encrypted prayers.
            </p>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-sm)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              style={{
                width: "18px",
                height: "18px",
                marginTop: "2px",
                accentColor: "var(--accent-primary)",
              }}
            />
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: "var(--font-sm)",
                lineHeight: 1.5,
              }}
            >
              I have saved my recovery code in a safe place and understand that
              I will need it to recover my prayers if I forget my password.
            </span>
          </label>

          <button
            className="btn-primary"
            onClick={handleConfirmComplete}
            disabled={!confirmChecked}
            style={{
              width: "100%",
              opacity: confirmChecked ? 1 : 0.5,
              cursor: confirmChecked ? "pointer" : "not-allowed",
            }}
          >
            I&apos;ve Saved My Code - Continue
          </button>
        </div>
      </div>
    );
  }

  // Confirm step - brief success message before closing
  return (
    <div className="card" style={{ maxWidth: "500px", margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-md)",
          padding: "var(--space-lg) 0",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "var(--success)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "32px", color: "white" }}>✓</span>
        </div>
        <h3
          style={{
            margin: 0,
            color: "var(--text-primary)",
            fontSize: "var(--font-lg)",
          }}
        >
          Setup Complete!
        </h3>
        <p
          style={{
            margin: 0,
            color: "var(--text-secondary)",
            textAlign: "center",
          }}
        >
          Your encryption has been upgraded.
          <br />
          You can view your recovery code anytime in Settings.
        </p>
      </div>
    </div>
  );
}
