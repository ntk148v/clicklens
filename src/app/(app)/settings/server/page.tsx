"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth";
import { Header } from "@/components/layout";
import { SettingsTable } from "@/components/settings/SettingsTable";

export default function ServerSettingsPage() {
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
      <Header title="Server Configs" />

      <div className="flex-1 p-6 overflow-hidden">
        <SettingsTable scope="server" readOnly />
      </div>
    </div>
  );
}
