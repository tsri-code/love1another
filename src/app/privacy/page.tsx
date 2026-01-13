"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";

export default function PrivacyPolicyPage() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      {user && <Navbar />}

      <main className="flex-1">
        <div
          className="container"
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            padding: "var(--space-xl) var(--container-padding)",
          }}
        >
          {/* Back button - go home for non-logged-in, back for logged-in */}
          <button
            onClick={() => (user ? router.back() : router.push("/"))}
            className="flex items-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            style={{
              marginBottom: "var(--space-lg)",
              gap: "var(--space-xs)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <svg
              style={{ width: "20px", height: "20px" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {user ? "Back" : "Home"}
          </button>

          {/* Header */}
          <h1
            className="font-serif font-bold text-[var(--text-primary)]"
            style={{
              fontSize: "var(--text-2xl)",
              marginBottom: "var(--space-sm)",
            }}
          >
            Privacy Policy
          </h1>
          <p
            className="text-[var(--text-muted)]"
            style={{
              fontSize: "var(--text-sm)",
              marginBottom: "var(--space-xl)",
            }}
          >
            Last updated: January 2026
          </p>

          {/* Content */}
          <div
            className="prose"
            style={{
              color: "var(--text-secondary)",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            <section style={{ marginBottom: "var(--space-xl)" }}>
              <h2
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                }}
              >
                Our Commitment to Your Privacy
              </h2>
              <p style={{ marginBottom: "var(--space-md)" }}>
                Love1Another is built with privacy at its core. We believe your 
                prayer life is between you and God, and we&apos;ve designed our 
                service to protect that sacred space.
              </p>
            </section>

            <section style={{ marginBottom: "var(--space-xl)" }}>
              <h2
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                }}
              >
                What We Collect
              </h2>
              <ul
                className="list-disc list-inside"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  <strong>Account Information:</strong> Your email address, username, 
                  and optional display name to identify your account.
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  <strong>Profile Pictures:</strong> Optional avatar images you 
                  choose to upload.
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  <strong>Encrypted Data:</strong> Your prayer requests and profile 
                  information are encrypted before being stored. We cannot read them.
                </li>
              </ul>
            </section>

            <section style={{ marginBottom: "var(--space-xl)" }}>
              <h2
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                }}
              >
                End-to-End Encryption
              </h2>
              <p style={{ marginBottom: "var(--space-md)" }}>
                All prayer requests and sensitive profile data are encrypted on 
                your device before being sent to our servers. This means:
              </p>
              <ul
                className="list-disc list-inside"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  We cannot read your prayers
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  Our staff cannot access your prayer content
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  Even if our servers were compromised, your prayer data would 
                  remain unreadable
                </li>
              </ul>
            </section>

            <section style={{ marginBottom: "var(--space-xl)" }}>
              <h2
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                }}
              >
                How We Use Your Information
              </h2>
              <ul
                className="list-disc list-inside"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  To provide and maintain the Love1Another service
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  To allow you to connect with friends and share prayer requests
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  To send important account-related emails (password resets, etc.)
                </li>
              </ul>
              <p>
                We do <strong>not</strong> sell, rent, or share your personal 
                information with third parties for marketing purposes.
              </p>
            </section>

            <section style={{ marginBottom: "var(--space-xl)" }}>
              <h2
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                }}
              >
                Data Storage
              </h2>
              <p style={{ marginBottom: "var(--space-md)" }}>
                Your data is stored securely using Supabase, a trusted database 
                provider. All connections are encrypted using TLS/SSL.
              </p>
            </section>

            <section style={{ marginBottom: "var(--space-xl)" }}>
              <h2
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                }}
              >
                Your Rights
              </h2>
              <ul
                className="list-disc list-inside"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  <strong>Access:</strong> You can view all your data within the app
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  <strong>Deletion:</strong> You can delete your account and all 
                  associated data at any time from Settings
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  <strong>Portability:</strong> Your prayer data is encrypted with 
                  keys only you control
                </li>
              </ul>
            </section>

            <section style={{ marginBottom: "var(--space-xl)" }}>
              <h2
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                }}
              >
                Cookies
              </h2>
              <p>
                We use essential cookies only for authentication and session 
                management. We do not use tracking cookies or analytics that 
                track your behavior across sites.
              </p>
            </section>

            <section style={{ marginBottom: "var(--space-xl)" }}>
              <h2
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                }}
              >
                Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will 
                notify you of any significant changes by posting the new policy 
                on this page.
              </p>
            </section>

            <section>
              <h2
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                }}
              >
                Contact
              </h2>
              <p>
                If you have questions about this Privacy Policy, please reach 
                out through the app or website.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="text-center text-[var(--text-muted)]"
        style={{
          padding: "var(--space-xl) var(--space-lg)",
          fontSize: "var(--text-sm)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div
          className="flex items-center justify-center flex-wrap"
          style={{ gap: "var(--space-md)", marginBottom: "var(--space-sm)" }}
        >
          <a
            href="/terms"
            className="hover:text-[var(--text-secondary)] transition-colors"
          >
            Terms of Service
          </a>
          <span>•</span>
          <a
            href="/how-to-use"
            className="hover:text-[var(--text-secondary)] transition-colors"
          >
            How to Use
          </a>
        </div>
        <p>© {new Date().getFullYear()} Love1Another</p>
      </footer>
    </div>
  );
}
