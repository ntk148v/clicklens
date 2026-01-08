"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth";
import { Header } from "@/components/layout";
import { HistoryTab } from "@/components/queries";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

function HistoryTabWrapper() {
  const searchParams = useSearchParams();
  const initialFingerprint = searchParams.get("fingerprint") || "";
  return (
    <HistoryTab
      initialFingerprint={initialFingerprint}
      searchParams={searchParams}
    />
  );
}

export default function QueryHistoryPage() {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !permissions?.canViewProcesses) {
      router.push("/");
    }
  }, [authLoading, permissions, router]);

  if (authLoading || !permissions?.canViewProcesses) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Query History" />
      <div className="flex-1 p-4 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <HistoryTabWrapper />
        </Suspense>
      </div>
    </div>
  );
}
