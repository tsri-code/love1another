"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";

export default function ContactPage() {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleContactSupport = () => {
    setIsRedirecting(true);

    // Navigate to home and trigger messages with @support username
    // The MessagesButton will look up the user by username
    sessionStorage.setItem("openMessageToUsername", "support");
    window.location.href = "/";
  };

  return (
    <div className="page">
      <AppHeader
        title="Contact Us"
        showBack={true}
        backHref="/"
      />

      <main className="flex-1">
        <div
          className="container"
          style={{
            maxWidth: "640px",
            paddingTop: "var(--space-xl)",
            paddingBottom: "var(--space-3xl)",
          }}
        >
          {/* Header Section */}
          <div className="text-center" style={{ marginBottom: "var(--space-2xl)" }}>
            <div
              className="mx-auto bg-[var(--accent-primary-light)] rounded-full flex items-center justify-center"
              style={{
                width: "80px",
                height: "80px",
                marginBottom: "var(--space-lg)",
              }}
            >
              <svg
                className="text-[var(--accent-primary)]"
                style={{ width: "40px", height: "40px" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h1
              className="font-serif font-semibold text-[var(--text-primary)]"
              style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-sm)" }}
            >
              Get in Touch
            </h1>
            <p
              className="text-[var(--text-secondary)]"
              style={{ lineHeight: "var(--leading-relaxed)" }}
            >
              Have a question, found a bug, or just want to say hello?
              We&apos;d love to hear from you!
            </p>
          </div>

          {/* Contact Options */}
          <div className="card card-elevated" style={{ marginBottom: "var(--space-lg)" }}>
            <h2
              className="font-serif font-semibold text-[var(--text-primary)]"
              style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-md)" }}
            >
              Message @support
            </h2>
            <p
              className="text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-relaxed)",
                marginBottom: "var(--space-lg)",
              }}
            >
              Send us a direct message within the app. This is the fastest way
              to reach us, and your message is end-to-end encrypted.
            </p>

            <button
              onClick={handleContactSupport}
              disabled={isRedirecting}
              className="btn btn-primary w-full"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-sm)",
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
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              {isRedirecting ? "Opening..." : "Message @support"}
            </button>
          </div>

          {/* What to Include */}
          <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
            <h2
              className="font-serif font-semibold text-[var(--text-primary)]"
              style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-md)" }}
            >
              What to Include
            </h2>
            <p
              className="text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-relaxed)",
                marginBottom: "var(--space-md)",
              }}
            >
              To help us assist you better, please include:
            </p>
            <ul
              className="text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-sm)",
                lineHeight: "1.8",
                paddingLeft: "var(--space-lg)",
                margin: 0,
              }}
            >
              <li><strong>Bug reports:</strong> What happened, what you expected, and steps to reproduce</li>
              <li><strong>Questions:</strong> Be as specific as possible</li>
              <li><strong>Feature requests:</strong> Describe what you&apos;d like to see</li>
              <li><strong>Feedback:</strong> We appreciate all thoughts and suggestions!</li>
            </ul>
          </div>

          {/* Response Time */}
          <div className="card">
            <h2
              className="font-serif font-semibold text-[var(--text-primary)]"
              style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-md)" }}
            >
              Response Time
            </h2>
            <p
              className="text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              Love1Another is a passion project maintained by a small team.
              We typically respond within 24-48 hours. Thank you for your patience!
            </p>
          </div>

          {/* Privacy Note */}
          <div
            className="text-center text-[var(--text-muted)]"
            style={{
              marginTop: "var(--space-2xl)",
              fontSize: "var(--text-sm)",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            <p style={{ marginBottom: "var(--space-xs)" }}>
              🔒 Your messages to @support are end-to-end encrypted.
            </p>
            <p>
              Only you and support can read them.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
