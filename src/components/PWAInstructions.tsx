"use client";

import { useState, useEffect } from "react";

interface InstructionStep {
  image: string;
  title: string;
  description: string;
}

const mobileSteps: InstructionStep[] = [
  {
    image: "/1.jpg",
    title: "Step 1: Open the Menu",
    description: "On your phone, tap the three dots (⋮) in your browser",
  },
  {
    image: "/2.jpg",
    title: "Step 2: Share",
    description: "Tap 'Share' from the menu options",
  },
  {
    image: "/3.jpg",
    title: "Step 3: More Options",
    description: "Scroll down and tap 'More' to see additional options",
  },
  {
    image: "/4.jpg",
    title: "Step 4: Add to Home Screen",
    description: "Tap 'Add to Home Screen' from the list",
  },
  {
    image: "/5.jpg",
    title: "Step 5: Save as Web App",
    description: "Give it a name and enable 'Open as Web App' if available, then tap 'Add'",
  },
];

// Desktop bookmark step - description will be dynamically updated with correct keyboard shortcut
const getDesktopSteps = (isMac: boolean): InstructionStep[] => [
  {
    image: "/favicon.jpeg",
    title: "Bookmark This Page",
    description: `Click the bookmark icon (⭐) in your browser's address bar, or press ${isMac ? "Cmd" : "Ctrl"}+D to save Love1Another for quick access.`,
  },
];

export function PWAInstructions() {
  const [isMac, setIsMac] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const checkPlatform = () => {
      setIsMac(
        typeof navigator !== "undefined" &&
          navigator.platform.toLowerCase().includes("mac")
      );
    };
    checkPlatform();
  }, []);

  // Combined steps: mobile steps first, then desktop bookmark option
  const steps = [...mobileSteps, ...getDesktopSteps(isMac)];
  const currentInstruction = steps[currentStep];

  const nextStep = () => {
    setCurrentStep((prev) => (prev + 1) % steps.length);
  };

  const prevStep = () => {
    setCurrentStep((prev) => (prev - 1 + steps.length) % steps.length);
  };

  // Show carousel with all steps (mobile + desktop)
  return (
    <div
      style={{
        background: "var(--surface-primary)",
        borderRadius: "var(--card-radius)",
        boxShadow: "var(--shadow-md)",
        overflow: "hidden",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "var(--space-lg)",
          borderBottom: "1px solid var(--border-light)",
          textAlign: "center",
        }}
      >
        <h3
          className="font-serif font-semibold text-[var(--text-primary)]"
          style={{
            fontSize: "var(--text-xl)",
            marginBottom: "var(--space-xs)",
          }}
        >
          {currentStep < mobileSteps.length
            ? "Add to Home Screen (Mobile)"
            : "Bookmark This Page (Desktop)"}
        </h3>
        <p
          className="text-[var(--text-secondary)]"
          style={{ fontSize: "var(--text-sm)" }}
        >
          {currentStep < mobileSteps.length
            ? "Follow these steps to add Love1Another to your phone's home screen"
            : "Save Love1Another for quick access on desktop"}
        </p>
      </div>

      {/* Image Carousel */}
      <div
        style={{
          position: "relative",
          background: "var(--bg-primary)",
          minHeight: "400px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Image */}
        <img
          src={currentInstruction.image}
          alt={currentInstruction.title}
          style={{
            width: "100%",
            height: "auto",
            maxHeight: "400px",
            objectFit: "contain",
            display: "block",
          }}
        />

        {/* Navigation Arrows */}
        {steps.length > 1 && (
          <>
            <button
              onClick={prevStep}
              style={{
                position: "absolute",
                left: "var(--space-md)",
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(0, 0, 0, 0.5)",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "white",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0, 0, 0, 0.7)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0, 0, 0, 0.5)";
              }}
              aria-label="Previous step"
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
            </button>
            <button
              onClick={nextStep}
              style={{
                position: "absolute",
                right: "var(--space-md)",
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(0, 0, 0, 0.5)",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "white",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0, 0, 0, 0.7)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0, 0, 0, 0.5)";
              }}
              aria-label="Next step"
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </>
        )}

        {/* Step Indicators */}
        {steps.length > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: "var(--space-md)",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "var(--space-xs)",
            }}
          >
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  border: "none",
                  background:
                    index === currentStep
                      ? "var(--accent-primary)"
                      : "rgba(255, 255, 255, 0.5)",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      <div
        style={{
          padding: "var(--space-lg)",
          textAlign: "center",
        }}
      >
        <h4
          className="font-semibold text-[var(--text-primary)]"
          style={{
            fontSize: "var(--text-base)",
            marginBottom: "var(--space-xs)",
          }}
        >
          {currentInstruction.title}
        </h4>
        <p
          className="text-[var(--text-secondary)]"
          style={{
            fontSize: "var(--text-sm)",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          {currentInstruction.description}
        </p>
      </div>
    </div>
  );
}
