"use client";

import { cn } from "@/lib/utils";

interface FlexContainerProps {
  children: React.ReactNode;
  className?: string;
  gap?: 1 | 2 | 3 | 4;
}

/**
 * Horizontal flex container with centered items
 * @example
 * <FlexRow>
 *   <Icon />
 *   <span>Text</span>
 * </FlexRow>
 */
export function FlexRow({ children, className, gap = 2 }: FlexContainerProps) {
  return (
    <div className={cn("flex items-center", `gap-${gap}`, className)}>
      {children}
    </div>
  );
}

/**
 * Vertical flex container
 * @example
 * <FlexCol gap={4}>
 *   <Header />
 *   <Content />
 * </FlexCol>
 */
export function FlexCol({ children, className, gap = 2 }: FlexContainerProps) {
  return (
    <div className={cn("flex flex-col", `gap-${gap}`, className)}>
      {children}
    </div>
  );
}

interface FlexBetweenProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Flex container with items spread between
 * @example
 * <FlexBetween>
 *   <LeftContent />
 *   <RightContent />
 * </FlexBetween>
 */
export function FlexBetween({ children, className }: FlexBetweenProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      {children}
    </div>
  );
}

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "muted" | "hover";
}

/**
 * Reusable card container with consistent styling
 */
export function CardContainer({
  children,
  className,
  variant = "default",
}: CardContainerProps) {
  const variants = {
    default: "bg-card shadow-stack rounded-lg",
    muted: "bg-muted shadow-border rounded-lg",
    hover: "bg-card shadow-stack rounded-lg hover:shadow-lg transition-all",
  };

  return <div className={cn(variants[variant], className)}>{children}</div>;
}

interface ScrollableContainerProps {
  children: React.ReactNode;
  className?: string;
  direction?: "y" | "x" | "both";
  maxHeight?: string;
}

/**
 * Scrollable container with custom scrollbar styling
 */
export function ScrollableContainer({
  children,
  className,
  direction = "y",
  maxHeight,
}: ScrollableContainerProps) {
  const directions = {
    y: "overflow-y-auto scrollbar-thin",
    x: "overflow-x-auto scrollbar-thin",
    both: "overflow-auto scrollbar-thin",
  };

  return (
    <div
      className={cn(directions[direction], className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      {children}
    </div>
  );
}

interface TextProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Monospace text for data/code display
 */
export function TextMono({ children, className }: TextProps) {
  return <span className={cn("font-mono text-sm tracking-tight", className)}>{children}</span>;
}

/**
 * Small muted text for secondary information
 */
export function TextMuted({ children, className }: TextProps) {
  return <span className={cn("text-xs text-muted-foreground", className)}>{children}</span>;
}

/**
 * Small heading text
 */
export function HeadingSm({ children, className }: TextProps) {
  return <span className={cn("text-sm font-semibold tracking-tight", className)}>{children}</span>;
}
