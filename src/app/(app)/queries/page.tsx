"use client";

import { useEffect } from "react";
import { useRouter, redirect } from "next/navigation";
import { useAuth } from "@/components/auth";

export default function QueriesPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !permissions?.canViewProcesses) {
      router.push("/");
    }
  }, [isLoading, permissions, router]);

  if (isLoading || !permissions?.canViewProcesses) {
    return null;
  }

  redirect("/queries/running");
}
