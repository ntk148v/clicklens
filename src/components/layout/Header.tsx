"use client";

import { ConnectionStatus } from "./ConnectionStatus";

interface HeaderProps {
  title?: string;
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-ch-border bg-ch-bg">
      <div className="flex items-center gap-4">
        {title && (
          <h1 className="text-lg font-semibold text-ch-text">{title}</h1>
        )}
        {children}
      </div>
      <div className="flex items-center gap-4">
        <ConnectionStatus />
      </div>
    </header>
  );
}
