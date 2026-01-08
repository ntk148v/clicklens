"use client";

import { LogsViewer } from "@/components/logging/LogsViewer";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LogsPage() {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !permissions?.canViewCluster) {
      router.push("/");
    }
  }, [authLoading, permissions, router]);

  if (authLoading || !permissions?.canViewCluster) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Logging"></Header>
      <div className="flex-1 overflow-hidden p-6">
        <LogsViewer />
      </div>
    </div>
  );
}
