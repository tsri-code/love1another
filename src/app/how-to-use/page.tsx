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
          {/* Back button */}
          <div style={{ padding: "var(--space-lg) 0" }}>
            <button
              onClick={() => router.back()}
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

          {/* Header */}
          <section
            className="text-center animate-fade-in"
            style={{
              paddingTop: "var(--space-md)",
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
                  <strong>Create an account</strong> — Sign up using your email
                  address. You&apos;ll receive a code to verify your account.
                  Enter the code to complete sign up.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Set up your profile</strong> — Go to Settings (from
                  the menu icon in the top right corner). Add your name, pick an
                  avatar color, and upload a profile picture if you&apos;d like.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Choose a username</strong> — Your username is how
                  friends find you. Pick something memorable, like{" "}
                  <em>@johndoe</em> or <em>@prayerwarrior</em>. Friends can
                  search for you using your username.
                </p>
                <p>
                  <strong>Your &quot;Me&quot; profile</strong> — When you create
                  an account, a personal profile called &quot;Me&quot; is
                  automatically created. This is where you can write your own
                  prayer requests that you want friends to pray for you about.
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
                  <strong>Add someone new</strong> — Tap the{" "}
                  <strong>&quot;+&quot; button</strong> on your home page. This
                  opens a form where you can create a new profile for someone
                  you want to pray for.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Give them a name</strong> — Enter their name (like
                  &quot;Mom&quot;, &quot;John&quot;, or &quot;Small Group&quot;).
                  Pick an avatar color, or upload a photo of them.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Person or Group?</strong> — Choose &quot;Person&quot;
                  if you&apos;re praying for one individual. Choose
                  &quot;Group&quot; if you&apos;re praying for multiple people
                  together (like your family, church, or Bible study group).
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Connect to a friend</strong> — If this person also
                  uses Love1Another and you&apos;re friends with them, you can
                  link their account to this profile. When you do, their prayer
                  requests will automatically appear in your prayer list for
                  them!
                </p>
                <p>
                  <strong>Edit anytime</strong> — Tap on any profile, then tap
                  the edit icon (pencil) to change their name, photo, or
                  connection settings.
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
                  <strong>View someone&apos;s prayers</strong> — Tap on any
                  person in your list to see all their prayer requests.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Add a prayer request</strong> — Type what you want to
                  pray for in the text box at the bottom and tap the send
                  button. You can add as many prayer requests as you need.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Immediate or Ongoing?</strong> — When adding a prayer,
                  you can mark it as &quot;Immediate&quot; (urgent, time-sensitive
                  needs) or &quot;Ongoing&quot; (continuous prayer needs like
                  health, relationships, or growth). This helps you prioritize
                  your prayers.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Mark prayers as answered</strong> — When God answers a
                  prayer, tap the checkmark icon to mark it answered. This moves
                  it to your &quot;Answered&quot; section as a beautiful reminder
                  of God&apos;s faithfulness.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Delete a prayer</strong> — Swipe left on any prayer
                  request (or tap the trash icon) to remove it from the list.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Track your prayer time</strong> — Tap the &quot;Prayed&quot;
                  button when you finish praying for someone. The app remembers
                  when you last prayed for each person, helping you stay
                  consistent in your prayer life.
                </p>
                <p>
                  <strong>Share a prayer</strong> — Tap the share icon on any
                  prayer to copy it or send it to a friend as a message.
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
                  <strong>Find friends</strong> — Open the menu (top right) and
                  tap &quot;Friends&quot;. Go to the &quot;Find&quot; tab to
                  search for other Love1Another users.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Search by name or username</strong> — You can search
                  using their name or username. Type their username with or
                  without the @ symbol (both <em>@johndoe</em> and{" "}
                  <em>johndoe</em> will work).
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Send a friend request</strong> — When you find
                  someone, tap &quot;Add&quot; to send them a friend request.
                  They&apos;ll get a notification and can accept or decline.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Accept friend requests</strong> — Go to the
                  &quot;Requests&quot; tab to see people who want to connect
                  with you. Tap &quot;Accept&quot; to become friends.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Link friends to profiles</strong> — After accepting a
                  friend request, you&apos;ll be asked to create a new profile
                  for them or link them to an existing profile. This connection
                  means their prayer requests will automatically show up in your
                  prayer list for them.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Invite others</strong> — Go to the &quot;Invite&quot;
                  tab to share your unique link. When you share it, the message
                  includes your username so they can easily find and add you
                  after signing up.
                </p>
                <p>
                  <strong>Remove a friend</strong> — In your Friends list, tap
                  the three dots next to any friend and select
                  &quot;Remove&quot; to disconnect from them.
                </p>
              </div>
            </div>

            {/* Messaging */}
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
                Messaging Friends
              </h2>
              <div
                className="text-[var(--text-secondary)]"
                style={{ lineHeight: "var(--leading-relaxed)" }}
              >
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Open Messages</strong> — On desktop, tap the
                  &quot;Messages&quot; bubble in the bottom corner. On mobile,
                  tap the menu and select &quot;Messages&quot;.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Start a new conversation</strong> — Tap the
                  &quot;+&quot; button to start a new message. Search for a
                  friend by their name or username (you can use @username too).
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Send a regular message</strong> — Type your message
                  and tap send. It&apos;s just like texting!
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Send a prayer request</strong> — Toggle on
                  &quot;Prayer Request&quot; before sending to mark your message
                  as a prayer request. Friends can then add it directly to their
                  prayer list.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Add prayers from messages</strong> — When someone
                  sends you a prayer request, tap &quot;Add to Profile&quot; to
                  save it to their profile in your prayer list. This way, you
                  won&apos;t forget to pray for them.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>View their profile</strong> — Tap on someone&apos;s
                  name or picture in a conversation to go directly to their
                  prayer profile.
                </p>
                <p>
                  <strong>Delete a conversation</strong> — Swipe left on any
                  conversation (or tap the trash icon) to delete it from your
                  messages.
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
                  6
                </span>
                Group Chats
              </h2>
              <div
                className="text-[var(--text-secondary)]"
                style={{ lineHeight: "var(--leading-relaxed)" }}
              >
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Create a group chat</strong> — In Messages, tap
                  &quot;+&quot; and then select &quot;Group&quot; to start a
                  conversation with multiple friends at once. Great for small
                  groups, families, or prayer partners!
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Name your group</strong> — Give your group a
                  meaningful name like &quot;Family Prayers&quot;, &quot;Bible
                  Study&quot;, or &quot;Prayer Warriors&quot;.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Add members</strong> — Select which friends you want
                  to include in the group. Only the person who created the group
                  can add new members later.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Share prayer requests</strong> — Anyone in the group
                  can send prayer requests. Other members can tap &quot;Add to
                  Profile&quot; to save those prayers to their own list.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Leave a group</strong> — To leave a group you&apos;re
                  in, simply delete the conversation. You&apos;ll be removed
                  from the group.
                </p>
                <p>
                  <strong>Manage members</strong> — If you created the group,
                  tap the group info icon to add new members or remove existing
                  ones.
                </p>
              </div>
            </div>

            {/* Settings & Account */}
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
                  7
                </span>
                Settings & Your Account
              </h2>
              <div
                className="text-[var(--text-secondary)]"
                style={{ lineHeight: "var(--leading-relaxed)" }}
              >
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Update your profile</strong> — Change your display
                  name, username, avatar color, or upload a new profile picture.
                  Your &quot;Me&quot; profile stays in sync with these changes.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Change your email</strong> — Update the email address
                  linked to your account. You&apos;ll need to verify the new
                  email.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Change your password</strong> — Keep your account
                  secure by updating your password regularly.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Dark mode</strong> — Switch between light and dark
                  themes to suit your preference.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Install as app</strong> — Add Love1Another to your
                  phone&apos;s home screen for quick access. It works just like
                  a regular app!
                </p>
                <p>
                  <strong>Delete your account</strong> — If you ever want to
                  leave, you can permanently delete your account and all your
                  data from the Settings page. This cannot be undone.
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
                Your Privacy is Protected
              </h2>
              <div
                className="text-[var(--text-secondary)]"
                style={{ lineHeight: "var(--leading-relaxed)" }}
              >
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Your prayers are encrypted</strong> — All your prayer
                  requests and messages are encrypted before being stored. This
                  means your private prayers stay private.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>We cannot read your prayers</strong> — Not even the
                  people who built this app can see what you&apos;re praying
                  for. Your conversations with God remain between you and Him.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Secure login</strong> — Your account is protected with
                  modern security practices including email verification.
                </p>
                <p style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>No tracking or ads</strong> — We don&apos;t track your
                  activity for advertising. Love1Another is built to serve you,
                  not to sell your data.
                </p>
                <p>
                  <strong>You own your data</strong> — Delete your account
                  anytime and all your data is permanently erased. No hidden
                  backups, no data retention.
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
                💡 Tips for a Richer Prayer Life
              </h2>
              <ul
                className="text-[var(--text-secondary)]"
                style={{
                  lineHeight: "var(--leading-relaxed)",
                  paddingLeft: "var(--space-lg)",
                }}
              >
                <li style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Pray regularly</strong> — Set a daily reminder to open
                  the app and pray through your list. Consistency matters more
                  than length.
                </li>
                <li style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Be specific</strong> — Specific prayers are easier to
                  recognize when answered. Instead of &quot;bless John&quot;,
                  try &quot;help John find a new job by month end&quot;.
                </li>
                <li style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Celebrate answers</strong> — Don&apos;t skip marking
                  prayers as answered! Looking back at answered prayers builds
                  faith and reminds you of God&apos;s faithfulness.
                </li>
                <li style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Connect with your community</strong> — Share your
                  invite link and build a prayer network. Praying for each other
                  strengthens relationships.
                </li>
                <li style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Start small</strong> — You don&apos;t need to add
                  everyone at once. Begin with the people closest to you and
                  grow your list over time.
                </li>
                <li style={{ marginBottom: "var(--space-sm)" }}>
                  <strong>Use the daily verse</strong> — Each person&apos;s
                  prayer page shows a Scripture verse. Let it guide and inspire
                  your prayers.
                </li>
                <li>
                  <strong>Install as an app</strong> — Add Love1Another to your
                  home screen for one-tap access. It works offline too!
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
