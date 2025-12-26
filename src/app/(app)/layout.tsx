"use client";

import { AuthProvider } from "@/components/auth";
import { Sidebar } from "@/components/layout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto scrollbar-thin">{children}</main>
      </div>
    </AuthProvider>
  );
}
