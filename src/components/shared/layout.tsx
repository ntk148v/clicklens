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
    <div className={cn("layout-flex-between", className)}>{children}</div>
  );
}

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "muted" | "hover";
}

/**
 * Reusable card container with consistent styling
 * @example
 * <CardContainer variant="hover">
 *   <CardContent />
 * </CardContainer>
 */
export function CardContainer({
  children,
  className,
  variant = "default",
}: CardContainerProps) {
  const variants = {
    default: "card-default",
    muted: "card-muted",
    hover: "card-hover",
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
 * @example
 * <ScrollableContainer direction="y" maxHeight="400px">
 *   <LongContent />
 * </ScrollableContainer>
 */
export function ScrollableContainer({
  children,
  className,
  direction = "y",
  maxHeight,
}: ScrollableContainerProps) {
  const directions = {
    y: "scrollable-y",
    x: "scrollable-x",
    both: "scrollable-both",
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
  return <span className={cn("text-mono-data", className)}>{children}</span>;
}

/**
 * Small muted text for secondary information
 */
export function TextMuted({ children, className }: TextProps) {
  return <span className={cn("text-muted-small", className)}>{children}</span>;
}

/**
 * Small heading text
 */
export function HeadingSm({ children, className }: TextProps) {
  return <span className={cn("text-heading-sm", className)}>{children}</span>;
}
