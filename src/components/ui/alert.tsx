"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type AlertVariant = "default" | "success" | "destructive" | "warning";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  icon?: React.ReactNode;
  onClose?: () => void;
}

const variantStyles: Record<AlertVariant, string> = {
  default:
    "bg-[var(--surface-elevated)] border-[var(--border-medium)] text-[var(--text-primary)]",
  success:
    "bg-[rgba(34,197,94,0.1)] border-[var(--success)] text-[var(--success)]",
  destructive:
    "bg-[rgba(239,68,68,0.1)] border-[var(--error)] text-[var(--error)]",
  warning:
    "bg-[rgba(245,158,11,0.1)] border-[var(--warning)] text-[var(--warning)]",
};

const iconColors: Record<AlertVariant, string> = {
  default: "var(--accent-primary)",
  success: "var(--success)",
  destructive: "var(--error)",
  warning: "var(--warning)",
};

function Alert({
  className,
  variant = "default",
  icon,
  onClose,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-lg border alert-responsive",
        "grid items-start gap-x-3 gap-y-0.5",
        icon ? "grid-cols-[24px_1fr_auto]" : "grid-cols-[1fr_auto]",
        variantStyles[variant],
        className
      )}
      style={{
        boxShadow: "var(--shadow-lg)",
      }}
      {...props}
    >
      {icon && (
        <div
          className="flex items-center justify-center"
          style={{ color: iconColors[variant] }}
        >
          {icon}
        </div>
      )}
      <div className="flex-1">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
          style={{ width: "20px", height: "20px" }}
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("font-medium tracking-tight", className)} {...props} />
  );
}

function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-sm opacity-90 mt-1", className)} {...props} />
  );
}

// Icons for convenience - responsive sizing
const iconClass = "alert-icon";

export function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${iconClass} ${className || ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${iconClass} ${className || ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${iconClass} ${className || ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${iconClass} ${className || ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

export { Alert, AlertTitle, AlertDescription };
