"use client";

import * as React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import {
  Alert,
  AlertTitle,
  AlertDescription,
  CheckCircleIcon,
  AlertCircleIcon,
  InfoIcon,
  WarningIcon,
  AlertVariant,
} from "./alert";

interface AlertBannerOptions {
  title: string;
  description?: string;
  variant?: AlertVariant;
  duration?: number; // ms, 0 = no auto-dismiss
}

interface AlertBannerContextType {
  showAlert: (options: AlertBannerOptions) => void;
  hideAlert: () => void;
}

const AlertBannerContext = createContext<AlertBannerContextType | null>(null);

export function useAlertBanner() {
  const context = useContext(AlertBannerContext);
  if (!context) {
    throw new Error("useAlertBanner must be used within AlertBannerProvider");
  }
  return context;
}

interface AlertBannerProviderProps {
  children: React.ReactNode;
}

export function AlertBannerProvider({ children }: AlertBannerProviderProps) {
  const [alert, setAlert] = useState<AlertBannerOptions | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showAlert = useCallback((options: AlertBannerOptions) => {
    setAlert(options);
    setIsVisible(true);

    if (options.duration !== 0) {
      const timeout = options.duration || 3000; // Default 3 seconds
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setAlert(null), 300); // Wait for animation
      }, timeout);
    }
  }, []);

  const hideAlert = useCallback(() => {
    // Immediately hide everything on dismiss
    setIsVisible(false);
    setAlert(null);
  }, []);

  const getIcon = (variant?: AlertVariant) => {
    switch (variant) {
      case "success":
        return <CheckCircleIcon />;
      case "destructive":
        return <AlertCircleIcon />;
      case "warning":
        return <WarningIcon />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <AlertBannerContext.Provider value={{ showAlert, hideAlert }}>
      {children}

      {/* Alert Banner - Bottom positioned, click anywhere to dismiss */}
      {alert && (
        <div
          className="fixed inset-0 z-[9999]"
          onClick={hideAlert}
          style={{ cursor: "pointer" }}
        >
          {/* Bottom-centered alert container */}
          <div
            className="absolute left-0 right-0 flex justify-center"
            style={{
              bottom: "var(--space-2xl)",
              padding: "0 var(--space-lg)",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                maxWidth: "450px",
                width: "100%",
                transform: isVisible ? "translateY(0)" : "translateY(20px)",
                opacity: isVisible ? 1 : 0,
                transition: "all 0.3s ease",
                pointerEvents: "auto",
              }}
            >
              <Alert
                variant={alert.variant || "default"}
                icon={getIcon(alert.variant)}
                onClose={hideAlert}
                style={{
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                  padding: "var(--space-lg)",
                }}
              >
                <AlertTitle>{alert.title}</AlertTitle>
                {alert.description && (
                  <AlertDescription>{alert.description}</AlertDescription>
                )}
              </Alert>
            </div>
          </div>
        </div>
      )}
    </AlertBannerContext.Provider>
  );
}
