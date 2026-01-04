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
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-background">
      <div className="flex items-center gap-4">
        {title && (
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        )}
        {children}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <ThemeToggle />
        <ConnectionStatus />
      </div>
    </header>
  );
}
