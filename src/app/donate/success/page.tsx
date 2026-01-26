"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";

function DonateSuccessContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [isVerifying, setIsVerifying] = useState(true);
  const [donationAmount, setDonationAmount] = useState<number | null>(null);

  useEffect(() => {
    // Optionally verify the session with your backend
    if (sessionId) {
      // For now, just show success - you could verify with Stripe if needed
      setIsVerifying(false);
      // You could fetch session details here if needed
    } else {
      setIsVerifying(false);
    }
  }, [sessionId]);

  return (
    <div
      className="min-h-screen flex flex-col page"
      style={{ background: "var(--bg-primary)" }}
    >
      {user && <Navbar />}

      <main className="flex-1 flex items-center justify-center donate-success-main">
        <div
          className="container text-center donate-success-container"
          style={{
            maxWidth: "500px",
            margin: "0 auto",
            padding: "var(--space-xl) var(--container-padding)",
          }}
        >
          {isVerifying ? (
            <div className="flex flex-col items-center">
              <div
                className="animate-spin rounded-full border-4 border-[var(--accent-primary)] border-t-transparent"
                style={{
                  width: "48px",
                  height: "48px",
                  marginBottom: "var(--space-lg)",
                }}
              />
              <p className="text-[var(--text-secondary)]">
                Verifying your donation...
              </p>
            </div>
          ) : (
            <>
              {/* Success Icon */}
              <div
                className="flex justify-center"
                style={{ marginBottom: "var(--space-xl)" }}
              >
                <div
                  className="donate-success-icon rounded-full flex items-center justify-center"
                  style={{
                    width: "100px",
                    height: "100px",
                    background: "var(--success-light)",
                  }}
                >
                  <svg
                    className="donate-success-checkmark"
                    style={{
                      width: "50px",
                      height: "50px",
                      color: "var(--success)",
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>

              {/* Thank You Message */}
              <h1
                className="font-serif font-bold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-2xl)",
                  marginBottom: "var(--space-md)",
                }}
              >
                Thank You!
              </h1>

              <p
                className="text-[var(--text-secondary)] donate-success-message"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-lg)",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                Your generous donation helps keep Love1Another free for 
                Christians around the world. May God bless you abundantly!
              </p>

              {donationAmount && (
                <p
                  className="text-[var(--accent-primary)] font-semibold"
                  style={{
                    fontSize: "var(--text-xl)",
                    marginBottom: "var(--space-lg)",
                  }}
                >
                  ${(donationAmount / 100).toFixed(2)}
                </p>
              )}

              {/* Email Receipt Notice */}
              <div
                className="card donate-receipt-card"
                style={{
                  marginBottom: "var(--space-xl)",
                }}
              >
                <div className="flex items-center justify-center flex-wrap" style={{ gap: "var(--space-sm)" }}>
                  <span style={{ fontSize: "24px" }}>📧</span>
                  <p className="text-[var(--text-secondary)]" style={{ margin: 0 }}>
                    A receipt has been sent to your email.
                  </p>
                </div>
              </div>

              {/* Scripture */}
              <div
                className="text-[var(--text-muted)] italic donate-success-scripture"
                style={{
                  fontSize: "var(--text-sm)",
                  marginBottom: "var(--space-xl)",
                }}
              >
                <p>
                  &ldquo;Give, and it will be given to you. A good measure, 
                  pressed down, shaken together and running over, will be 
                  poured into your lap.&rdquo;
                </p>
                <p className="text-[var(--accent-primary)] mt-2">— Luke 6:38</p>
              </div>

              {/* Action Buttons */}
              <div className="donate-success-buttons">
                <button
                  onClick={() => router.push("/")}
                  className="btn btn-primary donate-success-btn"
                >
                  Go to Home
                </button>
                <button
                  onClick={() => router.push("/donate")}
                  className="btn btn-secondary donate-success-btn"
                >
                  Donate Again
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function DonateSuccessPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex flex-col items-center justify-center"
          style={{ background: "var(--bg-primary)" }}
        >
          <div
            className="animate-spin rounded-full border-4 border-[var(--accent-primary)] border-t-transparent"
            style={{ width: "48px", height: "48px" }}
          />
        </div>
      }
    >
      <DonateSuccessContent />
    </Suspense>
  );
}
