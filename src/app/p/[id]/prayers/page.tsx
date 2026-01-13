"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AvatarCircle } from "@/components/AvatarCircle";
import { VerseCard } from "@/components/VerseCard";
import { PrayerCard } from "@/components/PrayerCard";
import { AddPrayerComposer } from "@/components/AddPrayerComposer";
import { AppHeader } from "@/components/AppHeader";
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
          showToast("Please log in again to access encrypted data", "error");
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

            setPrayers(decrypted.prayers || []);
          } catch (decryptError) {
            console.error("Failed to decrypt prayers:", decryptError);
            showToast("Could not decrypt prayers", "error");
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
              compact
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="page">
      <AppHeader
        showBack
        backHref="/"
        title={person.displayName}
        subtitle={`${activePrayerCount} active prayer${
          activePrayerCount !== 1 ? "s" : ""
        }${isSaving ? " • Saving..." : ""}`}
        actions={
          <div className="flex items-center" style={{ gap: "var(--space-xs)" }}>
            {/* Home button */}
            <button
              onClick={() => router.push("/")}
              className="btn btn-secondary btn-sm"
            >
              <svg
                style={{ width: "16px", height: "16px" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Home
            </button>

            {/* Edit button */}
            <button
              onClick={() => router.push(`/p/${id}/edit`)}
              className="icon-btn"
              aria-label="Edit profile"
              title={`Edit ${person.type}`}
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
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
          </div>
        }
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
            className="card flex items-center animate-fade-in"
            style={{
              gap: "var(--space-md)",
              marginBottom: "var(--space-lg)",
              position: "relative",
              zIndex: showSwitcher ? 100 : "auto",
            }}
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
                  className={`font-serif font-semibold text-[var(--text-primary)] flex items-center transition-colors ${
                    links.length > 0
                      ? "hover:text-[var(--accent-primary)] cursor-pointer"
                      : ""
                  }`}
                  style={{ fontSize: "var(--text-lg)", gap: "var(--space-xs)" }}
                  disabled={links.length === 0}
                >
                  {person.displayName}
                  {links.length > 0 && (
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

              <p
                className="text-[var(--text-muted)] flex items-center"
                style={{
                  fontSize: "var(--text-sm)",
                  gap: "6px",
                  marginTop: "2px",
                }}
              >
                {person.type === "group" && (
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
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                )}
                {activePrayerCount} active • {answeredPrayers.length} answered
                {links.length > 0 && (
                  <span
                    className="text-[var(--accent-primary)]"
                    style={{ marginLeft: "var(--space-xs)" }}
                  >
                    • {links.length} link{links.length !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
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
    </div>
  );
}
