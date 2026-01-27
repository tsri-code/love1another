"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AvatarCircle } from "@/components/AvatarCircle";
import { VerseCard } from "@/components/VerseCard";
import { PrayerCard } from "@/components/PrayerCard";
import { AddPrayerComposer } from "@/components/AddPrayerComposer";
import { AppHeader } from "@/components/AppHeader";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/lib/toast";
import { useCrypto } from "@/lib/use-crypto";
import { useAuth } from "@/components/AuthGuard";

// Prayer types
interface Prayer {
  id: string;
  text: string;
  category: "immediate" | "ongoing";
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  answered: boolean;
  answeredAt: string | null;
  lastPrayedAt: string | null;
  notAnsweredNote: string | null;
  tags: string[];
}

type PrayerCategory = "immediate" | "ongoing";

interface Person {
  id: string;
  displayName: string;
  type: "person" | "group";
  avatarPath: string | null;
  avatarInitials: string | null;
  avatarColor: string | null;
  verseId: number;
}

interface LinkInfo {
  id: string;
  displayName: string;
  person1: {
    id: string;
    displayName: string;
    avatarInitials: string | null;
    avatarColor: string | null;
    avatarPath?: string | null;
  } | null;
  person2: {
    id: string;
    displayName: string;
    avatarInitials: string | null;
    avatarColor: string | null;
    avatarPath?: string | null;
  } | null;
  prayerCount: number;
  createdAt: string;
}

// Generate unique IDs
function generateId(): string {
  return crypto.randomUUID();
}

export default function PrayerListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [person, setPerson] = useState<Person | null>(null);
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingPrayer, setIsAddingPrayer] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const { encryptPrayers, decryptPrayers, checkUnlocked } = useCrypto();
  const { user } = useAuth();
  const switcherRef = useRef<HTMLDivElement>(null);

  // Link-related state
  const [links, setLinks] = useState<LinkInfo[]>([]);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showLinkHelp, setShowLinkHelp] = useState(false);

  // Save prayers to server (encrypted)
  const savePrayers = useCallback(
    async (updatedPrayers: Prayer[], options?: { lastPrayedAt?: string }) => {
      if (!user?.id) return;

      setIsSaving(true);
      try {
        const { encrypted, iv } = await encryptPrayers(
          { prayers: updatedPrayers },
          user.id
        );

        const body: Record<string, unknown> = {
          encryptedPrayers: encrypted,
          encryptionIv: iv,
          prayerCount: updatedPrayers.filter((p) => !p.answered).length,
        };

        // Include lastPrayedAt if provided (when user marks a prayer as prayed)
        if (options?.lastPrayedAt) {
          body.lastPrayedAt = options.lastPrayedAt;
        }

        const res = await fetch(`/api/people/${id}/prayers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          throw new Error("Failed to save prayers");
        }
      } catch (error) {
        console.error("Error saving prayers:", error);
        showToast("Failed to save changes", "error");
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [user?.id, id, encryptPrayers, showToast]
  );

  // Load data on mount
  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      try {
        // Check if encryption is unlocked
        const unlocked = await checkUnlocked(user.id);

        if (!unlocked) {
          showToast("Please log in again to access your data", "error");
          router.push("/login");
          return;
        }

        // Fetch person data
        const personRes = await fetch(`/api/people/${id}`);

        if (!personRes.ok) {
          router.push("/");
          return;
        }
        const personData = await personRes.json();
        setPerson(personData.person);

        if (personData.links) {
          setLinks(personData.links);
        }

        // Fetch encrypted prayers
        const prayersRes = await fetch(`/api/people/${id}/prayers`);
        if (!prayersRes.ok) {
          setPrayers([]);
          setIsLoading(false);
          return;
        }

        const prayersData = await prayersRes.json();

        // Decrypt prayers if they exist
        if (prayersData.encryptedPrayers && prayersData.encryptionIv) {
          try {
            const decrypted = (await decryptPrayers(
              prayersData.encryptedPrayers,
              prayersData.encryptionIv,
              user.id
            )) as { prayers: Prayer[] };

            const decryptedPrayers = decrypted.prayers || [];
            setPrayers(decryptedPrayers);

            // Sync prayer count if it differs from what's stored
            const actualCount = decryptedPrayers.filter((p) => !p.answered).length;
            const storedCount = prayersData.prayerCount ?? 0;
            if (actualCount !== storedCount) {
              // Update the count in the background (don't wait)
              fetch(`/api/people/${id}/prayers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  encryptedPrayers: prayersData.encryptedPrayers,
                  encryptionIv: prayersData.encryptionIv,
                  prayerCount: actualCount,
                }),
              })
                .catch(() => {
                  // Silent fail - sync will retry next time
                });
            }
          } catch (decryptError) {
            console.error("Failed to decrypt prayers:", decryptError);
            showToast("Could not load prayers. Please try again.", "error");
            setPrayers([]);
          }
        } else {
          setPrayers([]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, user?.id, checkUnlocked, decryptPrayers, router, showToast]);

  // Handle click outside switcher
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        switcherRef.current &&
        !switcherRef.current.contains(e.target as Node)
      ) {
        setShowSwitcher(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddPrayer = async (text: string, category: PrayerCategory) => {
    if (!user?.id) return;

    setIsAddingPrayer(true);
    try {
      const now = new Date().toISOString();
      const newPrayer: Prayer = {
        id: generateId(),
        text: text.trim(),
        createdAt: now,
        updatedAt: now,
        pinned: false,
        answered: false,
        answeredAt: null,
        lastPrayedAt: null,
        tags: [],
        category,
        notAnsweredNote: null,
      };

      const updatedPrayers = [newPrayer, ...prayers];
      await savePrayers(updatedPrayers);
      setPrayers(updatedPrayers);
      showToast("Prayer added", "success");
    } catch (error) {
      console.error("Error adding prayer:", error);
      showToast("Failed to add prayer", "error");
    } finally {
      setIsAddingPrayer(false);
    }
  };

  const handleUpdatePrayer = async (
    prayerId: string,
    updates: Partial<Prayer>
  ) => {
    if (!user?.id) return;

    try {
      const updatedPrayers = prayers.map((p) =>
        p.id === prayerId
          ? { ...p, ...updates, updatedAt: new Date().toISOString() }
          : p
      );

      // If marking as prayed, update the profile's lastPrayedAt timestamp
      const saveOptions = updates.lastPrayedAt
        ? { lastPrayedAt: updates.lastPrayedAt }
        : undefined;

      await savePrayers(updatedPrayers, saveOptions);
      setPrayers(updatedPrayers);

      if (updates.answered === true) {
        showToast(
          updates.notAnsweredNote ? "Prayer closed" : "Prayer answered! ✓",
          "success"
        );
      } else if (updates.category) {
        showToast(
          `Moved to ${
            updates.category === "immediate" ? "Immediate" : "Ongoing"
          }`,
          "success"
        );
      } else {
        showToast("Prayer updated", "success");
      }
    } catch (error) {
      console.error("Error updating prayer:", error);
      showToast("Failed to update prayer", "error");
    }
  };

  const handleDeletePrayer = async (prayerId: string) => {
    if (!user?.id) return;

    try {
      const updatedPrayers = prayers.filter((p) => p.id !== prayerId);
      await savePrayers(updatedPrayers);
      setPrayers(updatedPrayers);
      showToast("Prayer deleted", "success");
    } catch (error) {
      console.error("Error deleting prayer:", error);
      showToast("Failed to delete prayer", "error");
    }
  };

  const handleMarkPrayed = async (prayerId: string) => {
    await handleUpdatePrayer(prayerId, {
      lastPrayedAt: new Date().toISOString(),
    });
    showToast("Marked as prayed ♡", "success");
  };

  const handleShareToMessage = (prayerText: string) => {
    // Store the prayer text to be sent as a message
    sessionStorage.setItem("sharePrayerText", prayerText);
    // Redirect to home where the message panel can be opened
    router.push("/?sharePrayer=true");
  };

  // Sort and categorize prayers
  const sortPrayers = (prayerList: Prayer[]) => {
    return [...prayerList].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  const immediatePrayers = sortPrayers(
    prayers.filter((p) => !p.answered && p.category === "immediate")
  );
  const ongoingPrayers = sortPrayers(
    prayers.filter((p) => !p.answered && p.category === "ongoing")
  );
  const answeredPrayers = sortPrayers(prayers.filter((p) => p.answered));
  const activePrayerCount = immediatePrayers.length + ongoingPrayers.length;

  if (isLoading || !person) {
    return (
      <div className="page-center">
        <div
          className="animate-pulse flex flex-col items-center"
          style={{ gap: "var(--space-md)" }}
        >
          <div
            className="bg-[var(--border-light)] rounded-full"
            style={{ width: "72px", height: "72px" }}
          />
          <div
            className="bg-[var(--border-light)] rounded"
            style={{ width: "100px", height: "20px" }}
          />
        </div>
      </div>
    );
  }

  const PrayerColumn = ({
    title,
    icon,
    prayers: columnPrayers,
    emptyMessage,
    accentColor,
  }: {
    title: string;
    icon: React.ReactNode;
    prayers: Prayer[];
    emptyMessage: string;
    accentColor: string;
  }) => (
    <div className="flex flex-col" style={{ minHeight: "300px" }}>
      {/* Column header */}
      <div
        className="flex items-center sticky top-0 bg-[var(--bg-primary)] z-10"
        style={{
          gap: "var(--space-sm)",
          marginBottom: "var(--space-md)",
          paddingBottom: "var(--space-sm)",
          borderBottom: "2px solid var(--border-light)",
        }}
      >
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: "32px",
            height: "32px",
            background: accentColor,
          }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3
            className="font-serif font-semibold text-[var(--text-primary)]"
            style={{ fontSize: "var(--text-base)" }}
          >
            {title}
          </h3>
        </div>
        <span
          className="badge"
          style={{
            background: "var(--bg-secondary)",
            color: "var(--text-muted)",
          }}
        >
          {columnPrayers.length}
        </span>
      </div>

      {/* Prayers */}
      {columnPrayers.length === 0 ? (
        <div
          className="flex-1 flex items-center justify-center text-center"
          style={{ padding: "var(--space-lg)" }}
        >
          <p
            className="text-[var(--text-muted)]"
            style={{ fontSize: "var(--text-sm)" }}
          >
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
          }}
        >
          {columnPrayers.map((prayer) => (
            <PrayerCard
              key={prayer.id}
              prayer={prayer}
              onUpdate={(updates) => handleUpdatePrayer(prayer.id, updates)}
              onDelete={() => handleDeletePrayer(prayer.id)}
              onMarkPrayed={() => handleMarkPrayed(prayer.id)}
              onShareToMessage={handleShareToMessage}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="page">
      <Navbar />
      <AppHeader
        showBack
        backHref="/"
        title={person.displayName}
        subtitle={`${activePrayerCount} active prayer${
          activePrayerCount !== 1 ? "s" : ""
        }${isSaving ? " • Saving..." : ""}`}
      />

      <main className="flex-1">
        <div
          className="container"
          style={{
            maxWidth: "1200px",
            paddingTop: "var(--space-lg)",
            paddingBottom: "var(--space-3xl)",
          }}
        >
          {/* Person header with profile switcher */}
          <section
            className="card animate-fade-in"
            style={{
              marginBottom: "var(--space-lg)",
              position: "relative",
              zIndex: showSwitcher ? 100 : "auto",
            }}
          >
            {/* Edit button in top right */}
            <button
              onClick={() => router.push(`/p/${id}/edit`)}
              className="btn btn-ghost edit-btn-xs"
              style={{
                position: "absolute",
                top: "var(--space-xs)",
                right: "var(--space-xs)",
                zIndex: 10,
                height: "32px",
                padding: "0 var(--space-sm)",
                fontSize: "var(--text-xs)",
              }}
              aria-label="Edit profile"
            >
              <svg
                style={{ width: "14px", height: "14px" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              Edit
            </button>

            <div
              className="flex items-center"
              style={{ gap: "var(--space-md)", paddingRight: "55px" }}
            >
              <AvatarCircle
                name={person.displayName}
                initials={person.avatarInitials || undefined}
                color={person.avatarColor || undefined}
                imagePath={person.avatarPath || undefined}
                size="md"
                interactive={false}
              />
              <div className="flex-1 min-w-0">
              {/* Profile name with link switcher */}
              <div className="relative" ref={switcherRef}>
                <button
                  onClick={() =>
                    links.length > 0 && setShowSwitcher(!showSwitcher)
                  }
                  className={`font-serif font-semibold text-[var(--text-primary)] transition-colors ${
                    links.length > 0
                      ? "hover:text-[var(--accent-primary)] cursor-pointer"
                      : ""
                  }`}
                  style={{ fontSize: "var(--text-lg)" }}
                  disabled={links.length === 0}
                >
                  {person.displayName}
                  {links.length > 0 && (
                    <span
                      className="tooltip-wrapper"
                      data-tooltip="View links"
                      style={{ 
                        display: "inline-flex",
                        alignItems: "center",
                        marginLeft: "4px",
                        verticalAlign: "middle",
                      }}
                    >
                      <svg
                        style={{
                          width: "16px",
                          height: "16px",
                          transition: "transform 0.2s",
                        }}
                        className={showSwitcher ? "rotate-180" : ""}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </span>
                  )}
                </button>

                {/* Links dropdown */}
                {showSwitcher && links.length > 0 && (
                  <div
                    className="absolute left-0 top-full card card-elevated animate-scale-in origin-top-left"
                    style={{
                      marginTop: "var(--space-xs)",
                      width: "280px",
                      padding: "var(--space-xs)",
                      zIndex: 9999,
                    }}
                  >
                    <p
                      className="text-[var(--text-muted)] px-2 pt-1 pb-2"
                      style={{
                        fontSize: "var(--text-xs)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Switch to
                    </p>
                    {links.map((link) => {
                      // Get the "other" person in the link (not the current person)
                      const otherPerson =
                        link.person1?.id === id ? link.person2 : link.person1;
                      return (
                        <div key={link.id} className="space-y-1">
                          {/* Link to the combined link page */}
                          <button
                            onClick={() => {
                              setShowSwitcher(false);
                              router.push(`/l/${link.id}/prayers`);
                            }}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                          >
                            <div className="flex -space-x-2">
                              {link.person1 && (
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 border-[var(--bg-secondary)] overflow-hidden"
                                  style={{
                                    backgroundColor: link.person1.avatarPath
                                      ? "transparent"
                                      : link.person1.avatarColor || "#888",
                                  }}
                                >
                                  {link.person1.avatarPath ? (
                                    <img
                                      src={link.person1.avatarPath}
                                      alt={link.person1.displayName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    link.person1.avatarInitials?.charAt(0) || "?"
                                  )}
                                </div>
                              )}
                              {link.person2 && (
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 border-[var(--bg-secondary)] overflow-hidden"
                                  style={{
                                    backgroundColor: link.person2.avatarPath
                                      ? "transparent"
                                      : link.person2.avatarColor || "#888",
                                  }}
                                >
                                  {link.person2.avatarPath ? (
                                    <img
                                      src={link.person2.avatarPath}
                                      alt={link.person2.displayName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    link.person2.avatarInitials?.charAt(0) || "?"
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                {link.displayName}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
                                Shared prayers
                              </p>
                            </div>
                            <svg
                              className="w-4 h-4 text-[var(--text-muted)]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                          {/* Link to the other person's profile */}
                          {otherPerson && (
                            <button
                              onClick={() => {
                                setShowSwitcher(false);
                                router.push(`/p/${otherPerson.id}/prayers`);
                              }}
                              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                            >
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden"
                                style={{
                                  backgroundColor: otherPerson.avatarPath
                                    ? "transparent"
                                    : otherPerson.avatarColor || "#888",
                                }}
                              >
                                {otherPerson.avatarPath ? (
                                  <img
                                    src={otherPerson.avatarPath}
                                    alt={otherPerson.displayName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  otherPerson.avatarInitials?.slice(0, 2) || "?"
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                  {otherPerson.displayName}
                                </p>
                                <p className="text-xs text-[var(--text-muted)]">
                                  Individual prayers
                                </p>
                              </div>
                              <svg
                                className="w-4 h-4 text-[var(--text-muted)]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Stats line */}
              <p
                className="text-[var(--text-muted)] flex items-center"
                style={{
                  fontSize: "var(--text-sm)",
                  gap: "6px",
                  marginTop: "2px",
                  whiteSpace: "nowrap",
                }}
              >
                {person.type === "group" && (
                  <svg
                    style={{ width: "14px", height: "14px", flexShrink: 0 }}
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
                {activePrayerCount} active • {answeredPrayers.length} answered
              </p>
              {/* Links line (separate row for small screens) */}
              {links.length > 0 && (
                <p
                  className="text-[var(--text-muted)] flex items-center"
                  style={{
                    fontSize: "var(--text-sm)",
                    gap: "4px",
                    marginTop: "2px",
                  }}
                >
                  <span
                    className="tooltip-wrapper"
                    data-tooltip="Click the arrow to view links"
                  >
                    <span className="text-[var(--accent-primary)] cursor-help">
                      {links.length} link{links.length !== 1 ? "s" : ""}
                    </span>
                  </span>
                  <button
                    onClick={() => setShowLinkHelp(true)}
                    className="text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                    style={{
                      padding: "2px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                    aria-label="What are links?"
                  >
                    <svg
                      style={{ width: "14px", height: "14px" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                </p>
              )}
              {/* Icon Legend - visible on first visit hint */}
              <p
                className="text-[var(--text-muted)] flex items-center flex-wrap"
                style={{
                  fontSize: "11px",
                  marginTop: "var(--space-xs)",
                  gap: "var(--space-sm)",
                }}
              >
                <span className="flex items-center" style={{ gap: "3px" }}>
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
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                  mark as prayed
                </span>
                <span className="flex items-center" style={{ gap: "3px" }}>
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
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                  share via message or copy prayer
                </span>
                <span className="flex items-center" style={{ gap: "3px" }}>
                  <svg
                    style={{ width: "12px", height: "12px" }}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                  more options for your prayers, explore!
                </span>
              </p>
              </div>
            </div>
          </section>

          {/* Verse */}
          <section
            className="animate-fade-in stagger-1"
            style={{ marginBottom: "var(--space-lg)" }}
          >
            <VerseCard verseId={person.verseId} />
          </section>

          {/* Add prayer composer */}
          <section
            className="animate-fade-in stagger-2"
            style={{ marginBottom: "var(--space-xl)" }}
          >
            <AddPrayerComposer
              onAdd={handleAddPrayer}
              isLoading={isAddingPrayer}
            />
          </section>

          {/* 3-column prayer layout */}
          {prayers.length === 0 ? (
            <section
              className="card text-center animate-fade-in stagger-3"
              style={{ padding: "var(--space-2xl)" }}
            >
              <div
                className="mx-auto bg-[var(--accent-primary-light)] rounded-full flex items-center justify-center"
                style={{
                  width: "64px",
                  height: "64px",
                  marginBottom: "var(--space-md)",
                }}
              >
                <svg
                  className="text-[var(--accent-primary)]"
                  style={{ width: "32px", height: "32px" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <h3
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-xs)",
                }}
              >
                No prayers yet
              </h3>
              <p
                className="text-[var(--text-muted)]"
                style={{ fontSize: "var(--text-base)" }}
              >
                Add your first prayer request above
              </p>
            </section>
          ) : (
            <section
              className="animate-fade-in stagger-3"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "var(--space-xl)",
              }}
            >
              <PrayerColumn
                title="Immediate"
                icon={
                  <svg
                    style={{ width: "16px", height: "16px" }}
                    className="text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                }
                prayers={immediatePrayers}
                emptyMessage="No urgent prayers right now"
                accentColor="var(--accent-gold)"
              />

              <PrayerColumn
                title="Ongoing"
                icon={
                  <svg
                    style={{ width: "16px", height: "16px" }}
                    className="text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                }
                prayers={ongoingPrayers}
                emptyMessage="No long-term prayers"
                accentColor="var(--accent-primary)"
              />

              <PrayerColumn
                title="Answered"
                icon={
                  <svg
                    style={{ width: "16px", height: "16px" }}
                    className="text-white"
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
                }
                prayers={answeredPrayers}
                emptyMessage="Answered prayers will appear here"
                accentColor="var(--success)"
              />
            </section>
          )}
        </div>
      </main>

      {/* Link Help Modal */}
      {showLinkHelp && (
        <div
          className="fixed inset-0 flex items-center justify-center animate-fade-in"
          style={{
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 9999,
            padding: "var(--space-md)",
          }}
          onClick={() => setShowLinkHelp(false)}
        >
          <div
            className="card card-elevated animate-scale-in"
            style={{
              maxWidth: "400px",
              width: "100%",
              padding: "var(--space-xl)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center"
              style={{
                marginBottom: "var(--space-md)",
                gap: "var(--space-sm)",
              }}
            >
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: "40px",
                  height: "40px",
                  background: "var(--accent-primary-light)",
                }}
              >
                <svg
                  className="text-[var(--accent-primary)]"
                  style={{ width: "20px", height: "20px" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <h3
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{ fontSize: "var(--text-lg)" }}
              >
                What are Links?
              </h3>
            </div>
            <p
              className="text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-relaxed)",
                marginBottom: "var(--space-md)",
              }}
            >
              Links let you create a shared prayer list between two people.
            </p>
            <p
              className="text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-relaxed)",
                marginBottom: "var(--space-md)",
              }}
            >
              <strong>For example:</strong> Link two people who are married so you have their individual prayers AND their shared prayers together!
            </p>
            <p
              className="text-[var(--text-muted)]"
              style={{
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-relaxed)",
                marginBottom: "var(--space-lg)",
              }}
            >
              Click the arrow next to the name above to switch between the individual and linked prayer lists.
            </p>
            <button
              onClick={() => setShowLinkHelp(false)}
              className="btn btn-primary btn-full"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
