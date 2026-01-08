"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";

import { useAuth } from "@/components/auth";
import { SettingsTable } from "@/components/settings/SettingsTable";
import { Header } from "@/components/layout";
import { RefreshControl } from "@/components/monitoring";

export default function SettingsPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && permissions && !permissions.canViewSettings) {
      router.push("/");
    }
  }, [permissions, isLoading, router]);

  if (isLoading || !permissions?.canViewSettings) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Settings & Configs" />

      <div className="flex-1 p-6 overflow-auto">
        <SettingsTable />
      </div>
    </div>
  );
}
