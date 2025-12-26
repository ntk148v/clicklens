"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Circle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`
                flex items-center gap-1.5 px-2 py-1 font-mono text-xs
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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={checkConnection}
              disabled={status.loading}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  status.loading ? "animate-spin" : ""
                }`}
              />
            </Button>
          </div>
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
