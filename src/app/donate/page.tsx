"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { useRouter } from "next/navigation";

const DONATION_AMOUNTS = [5, 10, 25, 50, 100];

export default function DonatePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDonate = async () => {
    const amount = selectedAmount || parseFloat(customAmount);

    if (!amount || amount < 1) {
      setError("Please enter a valid donation amount (minimum $1)");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/donate/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          email: user?.email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsProcessing(false);
    }
  };

  const getDonationAmount = () => {
    if (selectedAmount) return selectedAmount;
    if (customAmount) return parseFloat(customAmount);
    return 0;
  };

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
            maxWidth: "600px",
            margin: "0 auto",
            padding: "var(--space-xl) var(--container-padding)",
          }}
        >
          {/* Back button for non-logged-in users */}
          {!user && (
            <button
              onClick={() => router.push("/")}
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
              Back to Home
            </button>
          )}

          {/* Header */}
          <div
            className="text-center"
            style={{ marginBottom: "var(--space-2xl)" }}
          >
            <div
              className="flex justify-center"
              style={{ marginBottom: "var(--space-lg)" }}
            >
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: "80px",
                  height: "80px",
                  background: "var(--accent-primary-light)",
                }}
              >
                <span style={{ fontSize: "40px" }}>💝</span>
              </div>
            </div>
            <h1
              className="font-serif font-bold text-[var(--text-primary)]"
              style={{
                fontSize: "var(--text-2xl)",
                marginBottom: "var(--space-sm)",
              }}
            >
              Support Love1Another
            </h1>
            <p
              className="text-[var(--text-secondary)]"
              style={{ fontSize: "var(--text-base)" }}
            >
              Help keep this ministry free for everyone
            </p>
          </div>

          {/* Message Card */}
          <div
            className="card"
            style={{
              padding: "var(--space-xl)",
              marginBottom: "var(--space-xl)",
            }}
          >
            <div
              className="text-[var(--text-secondary)]"
              style={{
                lineHeight: "var(--leading-relaxed)",
                fontSize: "var(--text-base)",
              }}
            >
              <p style={{ marginBottom: "var(--space-md)" }}>
                Dear Brothers and Sisters in Christ,
              </p>
              <p style={{ marginBottom: "var(--space-md)" }}>
                Love1Another is and will always be a{" "}
                <strong>free service</strong>. My heart&apos;s desire is to keep
                it that way for all my Christian brothers and sisters who want
                to deepen their prayer lives.
              </p>
              <p style={{ marginBottom: "var(--space-md)" }}>
                However, running a website does come with costs — servers,
                security, and development all require resources. If you are
                willing and able, a donation of any amount would help keep this
                site running.
              </p>
              <p style={{ marginBottom: "var(--space-md)" }}>
                <strong>Please feel no obligation.</strong> If you cannot
                donate, please continue using Love1Another freely and with joy.
                I will always do everything in my power to keep this site free
                of charge.
              </p>
              <p className="text-[var(--text-primary)] font-medium">
                Thank you for being part of this community.
              </p>
              <p
                className="text-[var(--text-muted)] italic"
                style={{ marginTop: "var(--space-md)" }}
              >
                &ldquo;Each of you should give what you have decided in your
                heart to give, not reluctantly or under compulsion, for God
                loves a cheerful giver.&rdquo;
                <br />
                <span className="text-[var(--accent-primary)]">
                  — 2 Corinthians 9:7
                </span>
              </p>
            </div>
          </div>

          {/* Donation Amount Selection */}
          <div
            className="card"
            style={{
              padding: "var(--space-xl)",
              marginBottom: "var(--space-lg)",
            }}
          >
            <h2
              className="font-serif font-semibold text-[var(--text-primary)]"
              style={{
                fontSize: "var(--text-lg)",
                marginBottom: "var(--space-lg)",
                textAlign: "center",
              }}
            >
              Choose an Amount
            </h2>

            {/* Preset amounts */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
                gap: "var(--space-sm)",
                marginBottom: "var(--space-lg)",
              }}
            >
              {DONATION_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => {
                    setSelectedAmount(amount);
                    setCustomAmount("");
                  }}
                  className="btn"
                  style={{
                    height: "56px",
                    fontSize: "var(--text-lg)",
                    fontWeight: "600",
                    background:
                      selectedAmount === amount
                        ? "var(--accent-primary)"
                        : "var(--surface-secondary)",
                    color:
                      selectedAmount === amount
                        ? "white"
                        : "var(--text-primary)",
                    border:
                      selectedAmount === amount
                        ? "none"
                        : "1px solid var(--border-medium)",
                  }}
                >
                  ${amount}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div style={{ marginBottom: "var(--space-lg)" }}>
              <label
                className="text-[var(--text-secondary)] block"
                style={{
                  fontSize: "var(--text-sm)",
                  marginBottom: "var(--space-xs)",
                }}
              >
                Or enter a custom amount
              </label>
              <div className="relative">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  style={{ fontSize: "var(--text-lg)" }}
                >
                  $
                </span>
                <input
                  type="number"
                  className="input"
                  style={{
                    paddingLeft: "32px",
                    height: "56px",
                    fontSize: "var(--text-lg)",
                  }}
                  placeholder="0.00"
                  min="1"
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(null);
                  }}
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                className="text-[var(--error)]"
                style={{
                  fontSize: "var(--text-sm)",
                  marginBottom: "var(--space-md)",
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            {/* Donate button */}
            <button
              className="btn btn-primary w-full"
              style={{
                height: "56px",
                fontSize: "var(--text-lg)",
              }}
              onClick={handleDonate}
              disabled={isProcessing || getDonationAmount() < 1}
            >
              {isProcessing ? (
                "Processing..."
              ) : getDonationAmount() > 0 ? (
                <>Donate ${getDonationAmount().toFixed(2)}</>
              ) : (
                "Select an Amount"
              )}
            </button>

            {/* Security note */}
            <p
              className="text-[var(--text-muted)] text-center"
              style={{
                fontSize: "var(--text-xs)",
                marginTop: "var(--space-md)",
              }}
            >
              🔒 Secure payment powered by Stripe
            </p>
          </div>

          {/* No obligation reminder */}
          <p
            className="text-[var(--text-muted)] text-center"
            style={{ fontSize: "var(--text-sm)" }}
          >
            No account required to donate. You will receive an email receipt.
          </p>
        </div>
      </main>
    </div>
  );
}
