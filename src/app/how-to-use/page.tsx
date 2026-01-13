"use client";

import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/components/AuthGuard";

export default function HowToUsePage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="page">
      {user && <Navbar />}

      <main className="flex-1">
        <div
          className="container"
          style={{ maxWidth: "720px", margin: "0 auto" }}
        >
          {/* Back button for non-logged-in users */}
          {!user && (
            <div style={{ padding: "var(--space-lg) 0" }}>
              <button
                onClick={() => router.push("/")}
                className="btn btn-ghost"
                style={{ gap: "var(--space-xs)" }}
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back
              </button>
            </div>
          )}

          {/* Header */}
          <section
            className="text-center animate-fade-in"
            style={{
              paddingTop: user ? "var(--space-2xl)" : "var(--space-md)",
              paddingBottom: "var(--space-xl)",
            }}
          >
            <div
              className="mx-auto flex items-center justify-center bg-[var(--accent-primary-light)] rounded-full"
              style={{
                width: "72px",
                height: "72px",
                marginBottom: "var(--space-lg)",
              }}
            >
              <span style={{ fontSize: "32px" }}>📖</span>
            </div>
            <h1
              className="font-serif font-bold text-[var(--text-primary)]"
              style={{
                fontSize: "var(--text-2xl)",
                marginBottom: "var(--space-sm)",
              }}
            >
              How to Use Love1Another
            </h1>
            <p
              className="text-[var(--text-secondary)]"
              style={{ fontSize: "var(--text-base)" }}
            >
              A simple guide to help you get started
            </p>
          </section>

          {/* Content */}
          <section
            className="animate-fade-in stagger-1"
            style={{ paddingBottom: "var(--space-3xl)" }}
          >
            {/* Getting Started */}
            <div
              className="card"
              style={{
                padding: "var(--space-xl)",
                marginBottom: "var(--space-lg)",
              }}
            >
              <h2
                className="font-serif font-semibold text-[var(--text-primary)] flex items-center"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                  gap: "var(--space-sm)",
                }}
              >
                <span
                  className="flex items-center justify-center bg-[var(--accent-primary)] text-white rounded-full"
                  style={{
                    width: "28px",
                    height: "28px",
                    fontSize: "var(--text-sm)",
                    flexShrink: 0,
                  }}
                >
                  1
                </span>
                Getting Started
              </h2>
              <div
                className="text-[var(--text-secondary)]"
                style={{ lineHeight: "var(--leading-relaxed)" }}
              >
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Create an account</strong> using your email address.
                  You&apos;ll receive a verification email to confirm your
                  account.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Set up your profile</strong> in the Settings page. Add
                  your name, choose an avatar color, and optionally upload a
                  profile picture.
                </p>
                <p>
                  <strong>Choose a username</strong> so friends can find and
                  connect with you.
                </p>
              </div>
            </div>

            {/* Adding People */}
            <div
              className="card"
              style={{
                padding: "var(--space-xl)",
                marginBottom: "var(--space-lg)",
              }}
            >
              <h2
                className="font-serif font-semibold text-[var(--text-primary)] flex items-center"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                  gap: "var(--space-sm)",
                }}
              >
                <span
                  className="flex items-center justify-center bg-[var(--accent-primary)] text-white rounded-full"
                  style={{
                    width: "28px",
                    height: "28px",
                    fontSize: "var(--text-sm)",
                    flexShrink: 0,
                  }}
                >
                  2
                </span>
                Adding People to Pray For
              </h2>
              <div
                className="text-[var(--text-secondary)]"
                style={{ lineHeight: "var(--leading-relaxed)" }}
              >
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  Click the <strong>&quot;+&quot; button</strong> on the home
                  page to add a new person or group.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Give them a name</strong> and choose their avatar
                  color. You can also upload a custom picture.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>
                    Choose &quot;Person&quot; or &quot;Group&quot;
                  </strong>{" "}
                  depending on whether you&apos;re praying for an individual or
                  a group (like a small group, family, or church).
                </p>
                <p>
                  <strong>Connect with a friend</strong> (optional) — if this
                  person uses Love1Another, you can link their profile to
                  receive their prayer requests automatically.
                </p>
              </div>
            </div>

            {/* Managing Prayers */}
            <div
              className="card"
              style={{
                padding: "var(--space-xl)",
                marginBottom: "var(--space-lg)",
              }}
            >
              <h2
                className="font-serif font-semibold text-[var(--text-primary)] flex items-center"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                  gap: "var(--space-sm)",
                }}
              >
                <span
                  className="flex items-center justify-center bg-[var(--accent-primary)] text-white rounded-full"
                  style={{
                    width: "28px",
                    height: "28px",
                    fontSize: "var(--text-sm)",
                    flexShrink: 0,
                  }}
                >
                  3
                </span>
                Managing Prayer Requests
              </h2>
              <div
                className="text-[var(--text-secondary)]"
                style={{ lineHeight: "var(--leading-relaxed)" }}
              >
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  Click on a person to view their <strong>prayer list</strong>.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Add prayer requests</strong> by typing in the text box
                  and pressing send. You can add as many as you need.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>
                    Mark prayers as &quot;Immediate&quot; or &quot;Ongoing&quot;
                  </strong>{" "}
                  — immediate prayers are urgent needs, ongoing prayers are
                  continuous requests.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  When God answers, <strong>mark prayers as answered</strong> to
                  celebrate what He&apos;s done. Answered prayers are kept as a
                  record of God&apos;s faithfulness.
                </p>
                <p>
                  <strong>Track when you last prayed</strong> — the app shows
                  when you last prayed for each person to help you stay
                  consistent.
                </p>
              </div>
            </div>

            {/* Connecting with Friends */}
            <div
              className="card"
              style={{
                padding: "var(--space-xl)",
                marginBottom: "var(--space-lg)",
              }}
            >
              <h2
                className="font-serif font-semibold text-[var(--text-primary)] flex items-center"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                  gap: "var(--space-sm)",
                }}
              >
                <span
                  className="flex items-center justify-center bg-[var(--accent-primary)] text-white rounded-full"
                  style={{
                    width: "28px",
                    height: "28px",
                    fontSize: "var(--text-sm)",
                    flexShrink: 0,
                  }}
                >
                  4
                </span>
                Connecting with Friends
              </h2>
              <div
                className="text-[var(--text-secondary)]"
                style={{ lineHeight: "var(--leading-relaxed)" }}
              >
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  Go to the <strong>Friends page</strong> (from the menu) to
                  find and connect with other users.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Search by username</strong> and send a friend request.
                  Once they accept, you&apos;re connected!
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Link friends to profiles</strong> — when a friend
                  accepts your request, you can create a new profile for them or
                  link them to an existing one. This lets you receive their
                  prayer requests directly.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Send messages</strong> using the Messages button to
                  chat with friends and share updates.
                </p>
                <p>
                  <strong>Add prayer requests from messages</strong> — when a
                  friend sends you a prayer request in a message, you can tap
                  the &quot;Add to Profile&quot; button to save it directly to
                  their profile in your prayer list.
                </p>
              </div>
            </div>

            {/* Group Chats */}
            <div
              className="card"
              style={{
                padding: "var(--space-xl)",
                marginBottom: "var(--space-lg)",
              }}
            >
              <h2
                className="font-serif font-semibold text-[var(--text-primary)] flex items-center"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                  gap: "var(--space-sm)",
                }}
              >
                <span
                  className="flex items-center justify-center bg-[var(--accent-primary)] text-white rounded-full"
                  style={{
                    width: "28px",
                    height: "28px",
                    fontSize: "var(--text-sm)",
                    flexShrink: 0,
                  }}
                >
                  5
                </span>
                Group Chats
              </h2>
              <div
                className="text-[var(--text-secondary)]"
                style={{ lineHeight: "var(--leading-relaxed)" }}
              >
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Create a group chat</strong> — in the Messages
                  section, tap &quot;New Group&quot; to start a conversation
                  with multiple friends at once.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Name your group</strong> — give your group a
                  meaningful name like &quot;Small Group&quot;,
                  &quot;Family&quot;, or &quot;Prayer Partners&quot;.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Add members</strong> — select friends to add to the
                  group. Only the group creator can add new members.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Share prayer requests</strong> — when someone shares a
                  prayer request in the group, anyone can add it to their prayer
                  list for that person.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Leave a group</strong> — to leave a group chat, simply
                  delete the conversation from your messages. You&apos;ll be
                  removed from the group.
                </p>
                <p>
                  <strong>Remove members</strong> — the group creator can remove
                  members from the group if needed.
                </p>
              </div>
            </div>

            {/* Privacy & Security */}
            <div
              className="card"
              style={{
                padding: "var(--space-xl)",
                marginBottom: "var(--space-lg)",
              }}
            >
              <h2
                className="font-serif font-semibold text-[var(--text-primary)] flex items-center"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                  gap: "var(--space-sm)",
                }}
              >
                <span
                  className="flex items-center justify-center bg-[var(--success)] text-white rounded-full"
                  style={{
                    width: "28px",
                    height: "28px",
                    fontSize: "var(--text-sm)",
                    flexShrink: 0,
                  }}
                >
                  🔒
                </span>
                Your Data is Protected
              </h2>
              <div
                className="text-[var(--text-secondary)]"
                style={{ lineHeight: "var(--leading-relaxed)" }}
              >
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>End-to-end encryption</strong> — all your prayer
                  requests are encrypted on your device before being stored.
                  Only you can read them.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>We cannot see your prayers</strong> — even we
                  don&apos;t have access to your prayer content. Your
                  conversations with God remain private.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Secure authentication</strong> — your account is
                  protected with industry-standard security practices.
                </p>
                <p>
                  <strong>Your data belongs to you</strong> — you can delete
                  your account at any time from Settings, and all your data will
                  be permanently removed.
                </p>
              </div>
            </div>

            {/* Tips */}
            <div
              className="card bg-[var(--surface-accent)]"
              style={{ padding: "var(--space-xl)" }}
            >
              <h2
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-md)",
                }}
              >
                💡 Tips for Getting the Most Out of Love1Another
              </h2>
              <ul
                className="text-[var(--text-secondary)]"
                style={{
                  lineHeight: "var(--leading-relaxed)",
                  paddingLeft: "var(--space-lg)",
                }}
              >
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  <strong>Pray regularly</strong> — set a daily reminder to open
                  the app and pray through your list.
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  <strong>Be specific</strong> — the more specific your prayers,
                  the easier it is to recognize when they&apos;re answered.
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  <strong>Celebrate answers</strong> — marking prayers as
                  answered builds your faith and creates a record of God&apos;s
                  work.
                </li>
                <li style={{ marginBottom: "var(--space-xs)" }}>
                  <strong>Connect with your community</strong> — invite friends
                  to join so you can pray for each other.
                </li>
                <li>
                  <strong>Keep it simple</strong> — you don&apos;t need to add
                  everyone at once. Start with a few important people and grow
                  from there.
                </li>
              </ul>
            </div>
          </section>

          {/* CTA for non-logged-in users */}
          {!user && (
            <section
              className="text-center animate-fade-in stagger-2"
              style={{ paddingBottom: "var(--space-3xl)" }}
            >
              <button
                onClick={() => router.push("/login")}
                className="btn btn-primary btn-lg"
              >
                Get Started Free
              </button>
            </section>
          )}
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
            href="/terms"
            className="hover:text-[var(--text-secondary)] transition-colors"
          >
            Terms of Service
          </a>
        </div>
        <p>© {new Date().getFullYear()} Love1Another</p>
      </footer>
    </div>
  );
}
