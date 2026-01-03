"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Circle } from "lucide-react";

interface ConnectionStatus {
  connected: boolean;
  version?: string;
  loading: boolean;
  error?: string;
}

export function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    loading: true,
  });

  const checkConnection = async () => {
    setStatus((prev) => ({ ...prev, loading: true }));
    try {
      const response = await fetch("/api/clickhouse/ping");
      const data = await response.json();
      setStatus({
        connected: data.connected,
        version: data.version,
        loading: false,
        error: data.error,
      });
    } catch (error) {
      setStatus({
        connected: false,
        loading: false,
        error: error instanceof Error ? error.message : "Connection failed",
      });
    }
  };

  useEffect(() => {
    checkConnection();
    // No auto-refresh - individual pages handle their own refresh
  }, []);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`
              flex items-center gap-1.5 px-2 py-1 font-mono text-xs cursor-default
              ${
                status.loading
                  ? "border-muted-foreground text-muted-foreground"
                  : status.connected
                  ? "border-green-500/50 text-green-600"
                  : "border-red-500/50 text-red-600"
              }
            `}
          >
            <Circle
              className={`w-2 h-2 ${
                status.loading
                  ? "fill-muted-foreground text-muted-foreground animate-pulse"
                  : status.connected
                  ? "fill-green-500 text-green-500"
                  : "fill-red-500 text-red-500"
              }`}
            />
            {status.loading
              ? "Connecting..."
              : status.connected
              ? `v${status.version}`
              : "Disconnected"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {status.error ? (
            <p className="text-red-600">{status.error}</p>
          ) : status.connected ? (
            <p>Connected to ClickHouse {status.version}</p>
          ) : (
            <p>Not connected to ClickHouse</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
