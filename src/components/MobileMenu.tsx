"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MobileMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleNavigation = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };

  return (
    <div className="show-mobile" style={{ position: "relative" }}>
      {/* Hamburger Button */}
      <button
        onClick={toggleMenu}
        className="btn btn-ghost"
        style={{
          height: "44px",
          width: "44px",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Menu"
      >
        <svg
          style={{ width: "24px", height: "24px" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Menu Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.5)",
              zIndex: 998,
            }}
          />
          {/* Menu */}
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              background: "var(--surface-primary)",
              borderRadius: "var(--card-radius)",
              boxShadow: "var(--shadow-lg)",
              minWidth: "200px",
              zIndex: 999,
              border: "1px solid var(--border-light)",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => handleNavigation("/how-to-use")}
              style={{
                width: "100%",
                padding: "var(--space-md)",
                textAlign: "left",
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: "var(--text-base)",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              How It Works
            </button>
            <div
              style={{
                height: "1px",
                background: "var(--border-light)",
                margin: "0 var(--space-sm)",
              }}
            />
            <button
              onClick={() => handleNavigation("/login")}
              style={{
                width: "100%",
                padding: "var(--space-md)",
                textAlign: "left",
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: "var(--text-base)",
                fontWeight: 500,
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Sign In
            </button>
          </div>
        </>
      )}
    </div>
  );
}
