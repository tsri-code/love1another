"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AvatarCircle } from "@/components/AvatarCircle";
import { Navbar } from "@/components/Navbar";
import { VerseCard } from "@/components/VerseCard";
import { MessagesButton } from "@/components/MessagesButton";
import { LandingPage } from "@/components/LandingPage";
import { useAuth } from "@/components/AuthGuard";
import { formatDistanceToNow } from "date-fns";

interface Person {
  id: string;
  displayName: string;
  type: "person" | "group";
  avatarPath: string | null;
  avatarInitials: string | null;
  avatarColor: string | null;
  verseId: number;
  prayerCount: number;
  lastPrayedAt: string | null;
}

export default function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openMessages, setOpenMessages] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const router = useRouter();
  const hasCreatedDefaultProfile = useRef(false);

  // Show loading screen while auth is checking
  // This prevents flash of landing page during sign-in
  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="text-center animate-fade-in">
          <div
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto var(--space-md)",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <img
              src="/favicon.jpeg"
              alt="Love1Another"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div
            className="animate-pulse"
            style={{
              width: "100px",
              height: "8px",
              margin: "0 auto",
              borderRadius: "4px",
              background: "var(--border-light)",
            }}
          />
        </div>
      </div>
    );
  }

  // Show landing page for non-authenticated users
  if (!user) {
    return <LandingPage />;
  }

  const handleOpenMessages = useCallback(() => {
    setOpenMessages(true);
  }, []);

  const handleMessagesOpened = useCallback(() => {
    setOpenMessages(false);
  }, []);

  const handleUnreadCountChange = useCallback((count: number) => {
    setUnreadMessageCount(count);
  }, []);

  // Fetch on mount and when window regains focus (to refresh prayer counts)
  useEffect(() => {
    fetchPeople();

    // Refresh data when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchPeople();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const fetchPeople = async () => {
    try {
      const res = await fetch("/api/people");
      const data = await res.json();
      const fetchedPeople = data.people || [];

      // Auto-create "Me" profile if user has no profiles (only once)
      if (fetchedPeople.length === 0 && !hasCreatedDefaultProfile.current) {
        hasCreatedDefaultProfile.current = true;
        try {
          const createRes = await fetch("/api/people", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              displayName: "Me",
              type: "person",
              avatarInitials: "ME",
              avatarColor: "#7c9bb8",
            }),
          });

          if (createRes.ok) {
            // Refetch to get the new profile
            const refetchRes = await fetch("/api/people");
            const refetchData = await refetchRes.json();
            setPeople(refetchData.people || []);
            return;
          }
        } catch (createError) {
          console.error("Error creating default profile:", createError);
        }
      }

      setPeople(fetchedPeople);
    } catch (error) {
      console.error("Error fetching people:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonClick = (id: string) => {
    router.push(`/p/${id}/prayers`);
  };

  const handleAddPerson = () => {
    router.push("/add");
  };

  return (
    <div className="page">
      <Navbar
        onOpenMessages={handleOpenMessages}
        unreadMessageCount={unreadMessageCount}
      />

      <main className="flex-1">
        <div className="container">
          {/* === Header Section === */}
          <section
            className="text-center animate-fade-in"
            style={{
              paddingTop: "var(--space-2xl)",
              paddingBottom: "var(--space-lg)",
            }}
          >
            {/* Favicon */}
            <div
              className="mx-auto"
              style={{
                width: "64px",
                height: "64px",
                marginBottom: "var(--space-md)",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <img
                src="/favicon.jpeg"
                alt="Love1Another"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <h1
              className="font-serif font-bold text-[var(--text-primary)]"
              style={{ fontSize: "var(--text-3xl)" }}
            >
              Love1Another
            </h1>
          </section>

          {isLoading ? (
            <div
              className="flex items-center justify-center"
              style={{ padding: "var(--space-3xl) 0" }}
            >
              <div
                className="animate-pulse flex flex-col items-center"
                style={{ gap: "var(--space-md)" }}
              >
                <div
                  className="bg-[var(--border-light)] rounded-full"
                  style={{ width: "88px", height: "88px" }}
                />
                <div
                  className="bg-[var(--border-light)] rounded"
                  style={{ width: "80px", height: "16px" }}
                />
              </div>
            </div>
          ) : people.length === 0 ? (
            /* === Empty State === */
            <>
              {/* Verse Section - Anchors the purpose */}
              <section
                className="animate-fade-in stagger-1"
                style={{ paddingBottom: "var(--space-xl)" }}
              >
                <VerseCard verseId={1} />
              </section>

              {/* Empty State Card */}
              <section
                className="animate-fade-in stagger-2"
                style={{ paddingBottom: "var(--space-3xl)" }}
              >
                <div
                  className="card card-elevated text-center"
                  style={{ padding: "var(--space-2xl)" }}
                >
                  {/* Icon */}
                  <div
                    className="mx-auto bg-[var(--accent-primary-light)] rounded-full flex items-center justify-center"
                    style={{
                      width: "72px",
                      height: "72px",
                      marginBottom: "var(--space-lg)",
                    }}
                  >
                    <svg
                      className="text-[var(--accent-primary)]"
                      style={{ width: "36px", height: "36px" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>

                  <h2
                    className="font-serif font-semibold text-[var(--text-primary)]"
                    style={{
                      fontSize: "var(--text-xl)",
                      marginBottom: "var(--space-sm)",
                    }}
                  >
                    Start Your Prayer List
                  </h2>

                  <p
                    className="text-[var(--text-secondary)] mx-auto"
                    style={{
                      maxWidth: "360px",
                      marginBottom: "var(--space-xl)",
                      lineHeight: "var(--leading-relaxed)",
                    }}
                  >
                    Add people or groups you&apos;d like to pray for. Each has their
                    own private prayer list, protected by a passcode.
                  </p>

                  <button
                    onClick={handleAddPerson}
                    className="btn btn-primary btn-lg"
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add Your First Person
                  </button>
                </div>
              </section>
            </>
          ) : (
            /* === People Grid === */
            <>
              {/* Verse Section - Anchors the purpose */}
              <section
                className="animate-fade-in stagger-1"
                style={{ paddingBottom: "var(--space-xl)" }}
              >
                <VerseCard verseId={(people[0]?.verseId || 0) + 1 || 5} />
              </section>

              {/* People Grid */}
              <section
                className="animate-fade-in stagger-2"
                style={{ paddingBottom: "var(--space-3xl)" }}
              >
                <div
                  className="grid people-grid-responsive"
                  style={{
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(100px, 1fr))",
                    gap: "var(--space-md)",
                  }}
                >
                  {people.map((person, index) => (
                    <div
                      key={person.id}
                      className="flex flex-col items-center text-center animate-fade-in"
                      style={{
                        animationDelay: `${(index + 2) * 50}ms`,
                        opacity: 0,
                        animationFillMode: "forwards",
                      }}
                    >
                      <AvatarCircle
                        name={person.displayName}
                        initials={person.avatarInitials || undefined}
                        color={person.avatarColor || undefined}
                        imagePath={person.avatarPath || undefined}
                        size="lg"
                        onClick={() => handlePersonClick(person.id)}
                      />
                      <div style={{ marginTop: "var(--space-xs)" }}>
                        <p
                          className="font-medium text-[var(--text-primary)] truncate person-name"
                          style={{
                            maxWidth: "100px",
                            fontSize: "var(--text-sm)",
                          }}
                        >
                          {person.displayName}
                        </p>
                        <p
                          className="text-[var(--text-muted)] flex items-center justify-center person-stats"
                          style={{
                            fontSize: "var(--text-xs)",
                            marginTop: "2px",
                            gap: "4px",
                          }}
                        >
                          {person.type === "group" && (
                            <svg
                              style={{ width: "12px", height: "12px" }}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                              />
                            </svg>
                          )}
                          {person.prayerCount} prayer
                          {person.prayerCount !== 1 ? "s" : ""}
                        </p>
                        {person.lastPrayedAt && (
                          <p
                            className="text-[var(--success)]"
                            style={{
                              fontSize: "var(--text-xs)",
                              marginTop: "2px",
                            }}
                          >
                            Prayed{" "}
                            {formatDistanceToNow(
                              new Date(person.lastPrayedAt),
                              { addSuffix: true }
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Add Person Tile - Primary affordance */}
                  <div
                    className="flex flex-col items-center text-center animate-fade-in"
                    style={{
                      animationDelay: `${(people.length + 2) * 50}ms`,
                      opacity: 0,
                      animationFillMode: "forwards",
                    }}
                  >
                    <button
                      onClick={handleAddPerson}
                      className="rounded-full flex items-center justify-center transition-all group add-person-btn"
                      style={{
                        background: "var(--surface-accent)",
                        border: "2px solid var(--accent-primary)",
                        borderStyle: "solid",
                      }}
                      aria-label="Add person or group"
                    >
                      <svg
                        className="text-[var(--accent-primary)] transition-transform group-hover:scale-110 add-person-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </button>
                    <div style={{ marginTop: "var(--space-xs)" }}>
                      <p
                        className="font-medium text-[var(--accent-primary)] person-name"
                        style={{ fontSize: "var(--text-sm)" }}
                      >
                        Add
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {/* Messages Floating Button */}
      <MessagesButton
        onPrayerAdded={fetchPeople}
        externalOpen={openMessages}
        onExternalOpenHandled={handleMessagesOpened}
        onUnreadCountChange={handleUnreadCountChange}
      />
    </div>
  );
}
