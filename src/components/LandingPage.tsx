"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MobileMenu } from "./MobileMenu";
import { PWAInstructions } from "./PWAInstructions";

export function LandingPage() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Background gradient */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at top, var(--accent-primary-light) 0%, transparent 60%)",
          }}
        />

        <div
          className="container relative"
          style={{
            maxWidth: "960px",
            margin: "0 auto",
            padding: "0 var(--container-padding)",
          }}
        >
          {/* Nav */}
          <nav
            className="flex items-center justify-between"
            style={{ padding: "var(--space-lg) 0" }}
          >
            <div
              className="flex items-center"
              style={{ gap: "var(--space-sm)" }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                <img
                  src="/favicon.jpeg"
                  alt="Love1Another"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <span
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{ fontSize: "var(--text-lg)" }}
              >
                Love1Another
              </span>
            </div>

            <div
              className="flex items-center"
              style={{ gap: "var(--space-sm)" }}
            >
              <button
                onClick={() => router.push("/how-to-use")}
                className="btn btn-ghost hide-mobile"
                style={{ height: "44px" }}
              >
                How to Use
              </button>
              <button
                onClick={() => router.push("/login")}
                className="btn btn-primary hide-mobile"
                style={{ height: "44px" }}
              >
                Sign In
              </button>
              <MobileMenu />
            </div>
          </nav>

          {/* Hero Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
            style={{
              padding: "var(--space-2xl) 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {/* Logo */}
            <div
              className="landing-hero-logo"
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "24px",
                overflow: "hidden",
                boxShadow: "var(--shadow-lg)",
                marginBottom: "var(--space-lg)",
                flexShrink: 0,
              }}
            >
              <img
                src="/favicon.jpeg"
                alt="Love1Another"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>

            <h1
              className="font-serif font-bold text-[var(--text-primary)] landing-hero-title"
              style={{
                marginBottom: "var(--space-xs)",
                lineHeight: 1.2,
              }}
            >
              Love1Another
            </h1>
            <p
              className="font-serif font-bold text-[var(--text-primary)] landing-hero-title"
              style={{
                marginBottom: "var(--space-xs)",
                lineHeight: 1.2,
              }}
            >
              &amp;
            </p>
            <p
              className="font-serif font-bold text-[var(--text-primary)] landing-hero-title"
              style={{
                marginBottom: "var(--space-lg)",
                lineHeight: 1.2,
              }}
            >
              Pray Ceaselessly
            </p>

            <p
              className="text-[var(--text-secondary)] mx-auto"
              style={{
                fontSize: "var(--text-lg)",
                maxWidth: "540px",
                lineHeight: "var(--leading-relaxed)",
                marginBottom: "var(--space-xl)",
              }}
            >
              A private, encrypted space to keep track of your prayer requests
              and lift up the people in your life.
            </p>

            <div
              className="flex justify-center"
              style={{ gap: "var(--space-md)" }}
            >
              <button
                onClick={() => router.push("/login")}
                className="btn btn-primary btn-lg"
              >
                Get Started Free
              </button>
            </div>
          </div>

          {/* Scripture Quote */}
          <blockquote
            className={`text-center transition-all duration-700 delay-200 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
            style={{
              padding: "var(--space-xl)",
              background: "var(--surface-primary)",
              borderRadius: "var(--card-radius)",
              boxShadow: "var(--shadow-md)",
              maxWidth: "600px",
              margin: "0 auto var(--space-3xl)",
            }}
          >
            <p
              className="font-serif italic text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-lg)",
                lineHeight: "var(--leading-loose)",
              }}
            >
              &ldquo;Carry each other&apos;s burdens, and in this way you will
              fulfill the law of Christ.&rdquo;
            </p>
            <footer
              className="text-[var(--accent-primary)] font-medium"
              style={{
                marginTop: "var(--space-sm)",
                fontSize: "var(--text-sm)",
              }}
            >
              — Galatians 6:2
            </footer>
          </blockquote>
        </div>
      </header>

      {/* Features Section */}
      <section
        className="landing-section"
        style={{
          background: "var(--surface-secondary)",
        }}
      >
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <h2
            className="font-serif font-semibold text-[var(--text-primary)] text-center"
            style={{
              fontSize: "var(--text-2xl)",
              marginBottom: "var(--space-xl)",
            }}
          >
            How It Works
          </h2>

          <div
            className="grid landing-features"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            {/* Feature 1 */}
            <div
              className="flex flex-col items-center text-center"
              style={{ padding: "var(--space-md)" }}
            >
              <div
                className="flex items-center justify-center bg-[var(--accent-primary-light)] rounded-full landing-feature-icon"
                style={{
                  marginBottom: "var(--space-md)",
                }}
              >
                <span style={{ fontSize: "28px" }}>👥</span>
              </div>
              <h3
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-xs)",
                }}
              >
                Add People
              </h3>
              <p
                className="text-[var(--text-muted)]"
                style={{ fontSize: "var(--text-sm)" }}
              >
                Create profiles for friends, family, and groups you want to pray
                for regularly.
              </p>
            </div>

            {/* Feature 2 */}
            <div
              className="flex flex-col items-center text-center"
              style={{ padding: "var(--space-md)" }}
            >
              <div
                className="flex items-center justify-center bg-[var(--accent-primary-light)] rounded-full landing-feature-icon"
                style={{
                  marginBottom: "var(--space-md)",
                }}
              >
                <span style={{ fontSize: "28px" }}>🙏</span>
              </div>
              <h3
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-xs)",
                }}
              >
                Track Prayers
              </h3>
              <p
                className="text-[var(--text-muted)]"
                style={{ fontSize: "var(--text-sm)" }}
              >
                Add immediate and ongoing prayer requests. Mark them as answered
                when God moves.
              </p>
            </div>

            {/* Feature 3 */}
            <div
              className="flex flex-col items-center text-center"
              style={{ padding: "var(--space-md)" }}
            >
              <div
                className="flex items-center justify-center bg-[var(--accent-primary-light)] rounded-full landing-feature-icon"
                style={{
                  marginBottom: "var(--space-md)",
                }}
              >
                <span style={{ fontSize: "28px" }}>💬</span>
              </div>
              <h3
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-xs)",
                }}
              >
                Connect with Friends
              </h3>
              <p
                className="text-[var(--text-muted)]"
                style={{ fontSize: "var(--text-sm)" }}
              >
                Message friends and receive their prayer requests directly into
                your list.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PWA Instructions Section */}
      <section className="landing-section">
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <PWAInstructions />
        </div>
      </section>

      {/* Privacy Section */}
      <section className="landing-section">
        <div
          className="flex flex-col items-center"
          style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}
        >
          <div
            className="flex items-center justify-center bg-[var(--success-light)] rounded-full landing-feature-icon"
            style={{
              marginBottom: "var(--space-lg)",
            }}
          >
            <span style={{ fontSize: "28px" }}>🔒</span>
          </div>

          <h2
            className="font-serif font-semibold text-[var(--text-primary)]"
            style={{
              fontSize: "var(--text-2xl)",
              marginBottom: "var(--space-md)",
            }}
          >
            Your Prayers Are Private
          </h2>

          <p
            className="text-[var(--text-secondary)]"
            style={{
              fontSize: "var(--text-base)",
              lineHeight: "var(--leading-relaxed)",
              marginBottom: "var(--space-md)",
            }}
          >
            Every prayer request is <strong>end-to-end encrypted</strong>. Only
            you can read them — not us, not anyone else. Your conversations with
            God are between you and Him.
          </p>

          <p
            className="text-[var(--text-secondary)]"
            style={{
              fontSize: "var(--text-base)",
              lineHeight: "var(--leading-relaxed)",
              marginBottom: "var(--space-md)",
            }}
          >
            <strong>Delete anytime:</strong> When you delete your account, all
            your data is permanently erased. No backups, no traces — gone forever.
          </p>

          <p
            className="text-[var(--text-muted)]"
            style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-md)" }}
          >
            Built with love for the Body of Christ.
          </p>

          <div
            style={{
              marginTop: "var(--space-lg)",
              padding: "var(--space-md) var(--space-lg)",
              backgroundColor: "var(--surface-secondary)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--border-light)",
            }}
          >
            <p
              className="text-[var(--text-primary)]"
              style={{
                fontSize: "var(--text-base)",
                fontWeight: 500,
                textAlign: "center",
              }}
            >
              Questions? Create a free account and message{" "}
              <strong style={{ color: "var(--accent-primary)" }}>@support</strong>{" "}
              directly in the app.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        className="landing-section"
        style={{
          background: "var(--surface-secondary)",
        }}
      >
        <div
          style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}
        >
          <blockquote style={{ marginBottom: "var(--space-xl)" }}>
            <p
              className="font-serif italic text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-lg)",
                lineHeight: "var(--leading-loose)",
              }}
            >
              &ldquo;Therefore confess your sins to each other and pray for each
              other so that you may be healed. The prayer of a righteous person
              is powerful and effective.&rdquo;
            </p>
            <footer
              className="text-[var(--accent-primary)] font-medium"
              style={{
                marginTop: "var(--space-sm)",
                fontSize: "var(--text-sm)",
              }}
            >
              — James 5:16
            </footer>
          </blockquote>

          <button
            onClick={() => router.push("/login")}
            className="btn btn-primary btn-lg"
          >
            Start Praying Today
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="text-center text-[var(--text-muted)]"
        style={{
          padding: "var(--space-xl) var(--space-lg)",
          fontSize: "var(--text-sm)",
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
            href="/terms"
            className="hover:text-[var(--text-secondary)] transition-colors"
          >
            Terms of Service
          </a>
        </div>
        <p>© {new Date().getFullYear()} Love1Another. Made with ♡</p>
      </footer>
    </div>
  );
}
