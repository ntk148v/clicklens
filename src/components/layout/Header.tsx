"use client";

import { ConnectionStatus } from "./ConnectionStatus";
import { ThemeToggle } from "@/components/theme";

interface HeaderProps {
  title?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export function Header({ title, children, actions }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 h-auto min-h-14 px-4 md:px-6 py-2 border-b border-border bg-background">
      <div className="flex items-center gap-4">
        {title && (
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        )}
        {children}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <ThemeToggle />
        <ConnectionStatus />
      </div>
    </header>
  );
}
