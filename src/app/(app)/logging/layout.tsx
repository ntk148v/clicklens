"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoggingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !permissions?.canViewSystemLogs) {
      router.push("/");
    }
  }, [authLoading, permissions, router]);

  if (authLoading || !permissions?.canViewSystemLogs) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No tabs, just render children
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative min-h-0">
      {/* Use same container style as Monitoring if needed, or simple pass-through */}
      {children}
    </div>
  );
}
