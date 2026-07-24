"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SessionData {
  isLoggedIn: boolean;
  user?: {
    clusterId?: string;
  };
}

export function ClusterBadge() {
  const [clusterId, setClusterId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchApi("/api/auth/session");
        const data: SessionData = await res.json();
        if (data.isLoggedIn && data.user?.clusterId) {
          setClusterId(data.user.clusterId);
        }
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  if (!clusterId) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="font-mono text-xs cursor-default px-2 py-1">
            {clusterId}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Connected to cluster: {clusterId}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
