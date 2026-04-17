"use client";

import { cn } from "@/lib/utils";

export type StatusType = "ok" | "warning" | "critical" | "unknown";

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md" | "lg";
  showDot?: boolean;
  className?: string;
}

const statusConfig: Record<
  StatusType,
  { color: string; bgColor: string; label: string }
> = {
  ok: {
    color: "status-ok",
    bgColor: "bg-status-ok",
    label: "Healthy",
  },
  warning: {
    color: "status-warning",
    bgColor: "bg-status-warning",
    label: "Warning",
  },
  critical: {
    color: "status-critical",
    bgColor: "bg-status-critical",
    label: "Critical",
  },
  unknown: {
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    label: "Unknown",
  },
};

const sizeConfig = {
  sm: {
    badge: "px-1.5 py-0.5 text-xs",
    dot: "w-1.5 h-1.5",
  },
  md: {
    badge: "px-2 py-1 text-sm",
    dot: "w-2 h-2",
  },
  lg: {
    badge: "px-2.5 py-1.5 text-base",
    dot: "w-2.5 h-2.5",
  },
};

export function StatusBadge({
  status,
  label,
  size = "md",
  showDot = true,
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full uppercase tracking-wider",
        config.bgColor,
        config.color,
        sizes.badge,
        className
      )}
      style={{ fontSize: size === "sm" ? "10px" : "11px" }}
    >
      {showDot && (
        <span
          className={cn(
            "rounded-full shrink-0",
            sizes.dot,
            status === "ok" && "bg-green-500",
            status === "warning" && "bg-yellow-500",
            status === "critical" && "bg-red-500",
            status === "unknown" && "bg-gray-400"
          )}
        />
      )}
      {label || config.label}
    </span>
  );
}

// Simple dot indicator without text
export function StatusDot({
  status,
  size = "md",
  className,
}: {
  status: StatusType;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2.5 h-2.5",
    lg: "w-3.5 h-3.5",
  };

  return (
    <span
      className={cn(
        "inline-block rounded-full",
        sizes[size],
        status === "ok" && "bg-green-500",
        status === "warning" && "bg-yellow-500",
        status === "critical" && "bg-red-500",
        status === "unknown" && "bg-gray-400",
        className
      )}
      title={statusConfig[status].label}
    />
  );
}
