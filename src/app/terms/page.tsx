"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";

export default function TermsOfServicePage() {
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
            Terms of Service
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
                Welcome to Love1Another
              </h2>
              <p style={{ marginBottom: "var(--space-md)" }}>
                Love1Another is a prayer management service designed to help 
                Christians keep track of prayer requests and pray for one another. 
                By using our service, you agree to these terms.
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
                Use of Service
              </h2>
              <p style={{ marginBottom: "var(--space-md)" }}>
                You agree to use Love1Another for its intended purpose: managing 
                personal prayer lists and connecting with friends for prayer support.
              </p>
              <p style={{ marginBottom: "var(--space-md)" }}>You agree NOT to:</p>
              <ul
                className="list-disc list-inside"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  Use the service for any illegal or harmful purpose
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  Harass, abuse, or harm other users
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  Attempt to access other users&apos; data without permission
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  Use automated systems to access the service (bots, scrapers, etc.)
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  Interfere with or disrupt the service
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
                Your Account
              </h2>
              <ul
                className="list-disc list-inside"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  You are responsible for maintaining the security of your account
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  You must provide accurate information when creating your account
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  You are responsible for all activity under your account
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  You must be at least 13 years old to use this service
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
                Your Content
              </h2>
              <p style={{ marginBottom: "var(--space-md)" }}>
                You retain ownership of all content you create, including prayer 
                requests and profiles. Your prayer content is encrypted and we 
                cannot access it.
              </p>
              <p>
                By using our messaging features, you grant us permission to 
                transmit your messages to intended recipients.
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
                Free Service
              </h2>
              <p style={{ marginBottom: "var(--space-md)" }}>
                Love1Another is provided free of charge. We may accept voluntary 
                donations to help cover operating costs, but the core service 
                will remain free.
              </p>
              <p>
                We reserve the right to modify, suspend, or discontinue the 
                service at any time, though we will make reasonable efforts to 
                provide notice.
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
                Privacy
              </h2>
              <p>
                Your privacy is important to us. Please review our{" "}
                <a
                  href="/privacy"
                  className="text-[var(--accent-primary)] hover:underline"
                >
                  Privacy Policy
                </a>{" "}
                to understand how we collect and protect your information.
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
                Disclaimers
              </h2>
              <p style={{ marginBottom: "var(--space-md)" }}>
                Love1Another is provided &quot;as is&quot; without warranties of any kind, 
                either express or implied.
              </p>
              <p style={{ marginBottom: "var(--space-md)" }}>
                We do not guarantee that:
              </p>
              <ul
                className="list-disc list-inside"
                style={{ marginBottom: "var(--space-md)" }}
              >
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  The service will be uninterrupted or error-free
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  Any errors will be corrected
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  The service will meet your specific requirements
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
                Limitation of Liability
              </h2>
              <p>
                To the fullest extent permitted by law, Love1Another and its 
                operators shall not be liable for any indirect, incidental, 
                special, consequential, or punitive damages arising from your 
                use of the service.
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
                Termination
              </h2>
              <p style={{ marginBottom: "var(--space-md)" }}>
                You may terminate your account at any time by deleting it from 
                the Settings page. We may also terminate or suspend your account 
                if you violate these terms.
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
                Changes to Terms
              </h2>
              <p>
                We may update these Terms of Service from time to time. Continued 
                use of the service after changes constitutes acceptance of the 
                new terms.
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
                If you have questions about these Terms of Service, please reach 
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
            href="/privacy"
            className="hover:text-[var(--text-secondary)] transition-colors"
          >
            Privacy Policy
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
