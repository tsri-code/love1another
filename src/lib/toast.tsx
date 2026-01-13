"use client";

import { createContext, useContext, useState, useCallback } from "react";
import {
  Alert,
  AlertTitle,
  AlertDescription,
  CheckCircleIcon,
  AlertCircleIcon,
  InfoIcon,
} from "@/components/ui/alert";

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: "success" | "error" | "info";
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (
    title: string,
    typeOrOptions?:
      | Toast["type"]
      | { description?: string; type?: Toast["type"] }
  ) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (
      title: string,
      typeOrOptions?:
        | Toast["type"]
        | { description?: string; type?: Toast["type"] }
    ) => {
      const id = Math.random().toString(36).substring(7);

      // Handle both old (string type) and new (options object) signatures
      let type: Toast["type"] = "info";
      let description: string | undefined;

      if (typeof typeOrOptions === "string") {
        type = typeOrOptions;
      } else if (typeOrOptions) {
        type = typeOrOptions.type || "info";
        description = typeOrOptions.description;
      }

      setToasts((prev) => [...prev, { id, title, description, type }]);

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  const getIcon = (type: Toast["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircleIcon />;
      case "error":
        return <AlertCircleIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const getVariant = (
    type: Toast["type"]
  ): "success" | "destructive" | "default" => {
    switch (type) {
      case "success":
        return "success";
      case "error":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <div
      className="fixed left-0 right-0 z-[9999] flex justify-center toast-container"
      style={{
        pointerEvents: "none",
      }}
    >
      <div
        className="flex flex-col gap-3 toast-content"
        style={{
          width: "100%",
        }}
      >
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            style={{
              animation: "alertSlideIn 0.3s ease forwards",
              animationDelay: `${index * 50}ms`,
              opacity: 0,
              pointerEvents: "auto",
            }}
          >
            <Alert
              variant={getVariant(toast.type)}
              icon={getIcon(toast.type)}
              onClose={() => onDismiss(toast.id)}
              style={{
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
              }}
            >
              <AlertTitle>{toast.title}</AlertTitle>
              {toast.description && (
                <AlertDescription>{toast.description}</AlertDescription>
              )}
            </Alert>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes alertSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
