"use client";

import { Server } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUptime } from "@/lib/hooks/use-monitoring";
import type { DashboardResponse } from "@/services/monitoring";

interface NodeInfoProps {
  server: DashboardResponse['server'];
}

export function NodeInfo({ server }: NodeInfoProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Server className="w-4 h-4" />
          {server.hostname}
          <Badge variant="outline" className="ml-auto">
            v{server.version}
          </Badge>
          <Badge variant="outline">
            Uptime: {formatUptime(server.uptime)}
          </Badge>
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
