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
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    label: "Healthy",
  },
  warning: {
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    label: "Warning",
  },
  critical: {
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "Critical",
  },
  unknown: {
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
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
        "inline-flex items-center gap-1.5 font-medium rounded-full",
        config.bgColor,
        config.color,
        sizes.badge,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "rounded-full",
            sizes.dot,
            status === "ok" && "bg-green-500",
            status === "warning" && "bg-yellow-500",
            status === "critical" && "bg-red-500",
            status === "unknown" && "bg-gray-500"
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
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  return (
    <span
      className={cn(
        "inline-block rounded-full",
        sizes[size],
        status === "ok" && "bg-green-500",
        status === "warning" && "bg-yellow-500",
        status === "critical" && "bg-red-500",
        status === "unknown" && "bg-gray-500",
        className
      )}
      title={statusConfig[status].label}
    />
  );
}
