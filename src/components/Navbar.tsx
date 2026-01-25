"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthGuard";
import { getInitials } from "@/lib/utils";

interface NavbarProps {
  onOpenMessages?: () => void;
  unreadMessageCount?: number;
}

export function Navbar({
  onOpenMessages,
  unreadMessageCount = 0,
}: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, logout } = useAuth();

  const userName = user?.fullName || "User";
  const userEmail = user?.email || "";
  const avatarColor = user?.avatarColor || "#7c9bb8";
  const avatarPath = user?.avatarPath || null;

  // Fetch pending friend request count
  const fetchPendingCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const res = await fetch("/api/friends?type=pending");
      if (res.ok) {
        const data = await res.json();
        setPendingRequestCount(data.pendingRequests?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    }
  }, [user?.id]);

  // Fetch on mount and periodically
  useEffect(() => {
    fetchPendingCount();

    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [fetchPendingCount]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
  };

  const handleSettings = () => {
    setIsMenuOpen(false);
    router.push("/settings");
  };

  const handleFriends = () => {
    setIsMenuOpen(false);
    router.push("/friends");
  };

  const handleMessages = () => {
    setIsMenuOpen(false);
    if (onOpenMessages) {
      onOpenMessages();
    }
  };

  const handleHowToUse = () => {
    setIsMenuOpen(false);
    router.push("/how-to-use");
  };

  const handleContact = () => {
    setIsMenuOpen(false);
    router.push("/contact");
  };

  const totalNotifications = pendingRequestCount + unreadMessageCount;

  return (
    <nav
      className="flex items-center justify-between w-full navbar-main"
      style={{
        background: "var(--surface-primary)",
      }}
    >
      {/* Logo / App Name */}
      <div
        className="flex items-center cursor-pointer"
        style={{ gap: "var(--space-sm)" }}
        onClick={() => router.push("/")}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <img
            src="/favicon.jpeg"
            alt="Love1Another"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            suppressHydrationWarning
          />
        </div>
        <span
          className="font-serif font-semibold text-[var(--text-primary)] hide-mobile"
          style={{ fontSize: "var(--text-lg)" }}
        >
          Love1Another
        </span>
      </div>

      {/* Hamburger Menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center justify-center transition-colors"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "var(--card-radius-sm)",
            background: isMenuOpen ? "var(--surface-secondary)" : "transparent",
            border: "none",
            cursor: "pointer",
            position: "relative",
          }}
          aria-label="Menu"
        >
          {/* Hamburger Icon */}
          <svg
            style={{ width: "24px", height: "24px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className="text-[var(--text-primary)]"
          >
            {isMenuOpen ? (
              // X icon when open
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              // Hamburger icon when closed
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>

          {/* Notification Badge */}
          {totalNotifications > 0 && (
            <span
              className="absolute flex items-center justify-center"
              style={{
                top: "4px",
                right: "4px",
                minWidth: "18px",
                height: "18px",
                borderRadius: "9px",
                background: "var(--error)",
                color: "white",
                fontSize: "11px",
                fontWeight: "600",
                padding: "0 5px",
              }}
            >
              {totalNotifications > 9 ? "9+" : totalNotifications}
            </span>
          )}
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div
            className="dropdown-menu animate-fade-in"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              minWidth: "220px",
              zIndex: 100,
            }}
          >
            {/* User Info Header */}
            <div
              className="flex items-center"
              style={{
                padding: "var(--space-md)",
                gap: "var(--space-sm)",
                borderBottom: "1px solid var(--border-light)",
              }}
            >
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{
                  width: "36px",
                  height: "36px",
                  background: avatarPath ? "transparent" : avatarColor,
                  color: "white",
                  fontWeight: "600",
                  fontSize: "var(--text-sm)",
                }}
              >
                {avatarPath ? (
                  <img
                    src={avatarPath}
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user?.avatarInitials || getInitials(userName)
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <p
                  className="font-medium text-[var(--text-primary)] truncate"
                  style={{ fontSize: "var(--text-sm)" }}
                >
                  {userName}
                </p>
                <p
                  className="text-[var(--text-muted)] truncate"
                  style={{ fontSize: "var(--text-xs)" }}
                >
                  {userEmail}
                </p>
              </div>
            </div>

            {/* Menu Items */}
            {/* Messages - shown on mobile via menu */}
            <button
              className="dropdown-item show-mobile"
              onClick={handleMessages}
            >
              <svg
                style={{ width: "18px", height: "18px" }}
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
              <span className="flex-1">Messages</span>
              {unreadMessageCount > 0 && (
                <span
                  className="flex items-center justify-center"
                  style={{
                    minWidth: "20px",
                    height: "20px",
                    borderRadius: "10px",
                    background: "var(--accent-primary)",
                    color: "white",
                    fontSize: "11px",
                    fontWeight: "600",
                    padding: "0 6px",
                  }}
                >
                  {unreadMessageCount}
                </span>
              )}
            </button>

            <button className="dropdown-item" onClick={handleFriends}>
              <svg
                style={{ width: "18px", height: "18px" }}
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
              <span className="flex-1">Friends</span>
              {pendingRequestCount > 0 && (
                <span
                  className="flex items-center justify-center"
                  style={{
                    minWidth: "20px",
                    height: "20px",
                    borderRadius: "10px",
                    background: "var(--error)",
                    color: "white",
                    fontSize: "11px",
                    fontWeight: "600",
                    padding: "0 6px",
                  }}
                >
                  {pendingRequestCount}
                </span>
              )}
            </button>

            <button className="dropdown-item" onClick={handleSettings}>
              <svg
                style={{ width: "18px", height: "18px" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Settings
            </button>

            <button className="dropdown-item" onClick={handleHowToUse}>
              <svg
                style={{ width: "18px", height: "18px" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              How to Use
            </button>

            <button className="dropdown-item" onClick={handleContact}>
              <svg
                style={{ width: "18px", height: "18px" }}
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
              Contact Us
            </button>

            {/* Donate button hidden for now
            <button
              className="dropdown-item"
              onClick={() => {
                setIsMenuOpen(false);
                router.push("/donate");
              }}
            >
              <svg
                style={{ width: "18px", height: "18px" }}
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
              Donate
            </button>
            */}

            <div className="divider" style={{ margin: 0 }} />

            <button
              className="dropdown-item"
              onClick={handleLogout}
              style={{ color: "var(--error)" }}
            >
              <svg
                style={{ width: "18px", height: "18px" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Log out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
