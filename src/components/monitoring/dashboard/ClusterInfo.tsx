"use client";

import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { DashboardResponse } from "@/services/monitoring";

interface ClusterInfoProps {
  cluster: NonNullable<DashboardResponse['cluster']>;
}

export function ClusterInfo({ cluster }: ClusterInfoProps) {
  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Cluster: {cluster.name}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {cluster.activeNodes}/{cluster.totalNodes} active
              </Badge>
              <Badge variant="outline">
                {cluster.totalShards} shard
                {cluster.totalShards > 1 ? "s" : ""}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {cluster.nodes.map((node) => (
              <Tooltip key={`${node.hostName}-${node.port}`}>
                <TooltipTrigger asChild>
                  <div
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer
                      transition-colors hover:bg-muted/50
                      ${
                        !node.isActive
                          ? "border-red-500/50 bg-red-500/5"
                          : node.errorsCount > 0
                            ? "border-yellow-500/50 bg-yellow-500/5"
                            : "border-green-500/50 bg-green-500/5"
                      }
                    `}
                  >
                    {node.isActive ? (
                      node.errorsCount > 0 ? (
                        <AlertTriangle className="w-4 h-4 status-warning" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 status-ok" />
                      )
                    ) : (
                      <XCircle className="w-4 h-4 status-critical" />
                    )}
                    <span className="text-sm font-mono">
                      {node.hostName}
                    </span>
                    {node.isLocal && (
                      <Badge variant="secondary" className="text-xs">
                        local
                      </Badge>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Address:</span>
                    <span className="font-mono">
                      {node.hostAddress}:{node.port}
                    </span>
                    <span className="text-muted-foreground">Shard:</span>
                    <span>{node.shardNum}</span>
                    <span className="text-muted-foreground">Replica:</span>
                    <span>{node.replicaNum}</span>
                    <span className="text-muted-foreground">Errors:</span>
                    <span
                      className={
                        node.errorsCount > 0 ? "text-yellow-500" : ""
                      }
                    >
                      {node.errorsCount}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
