"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

import { Badge } from "@/components/ui/badge";
import type { ExplainType } from "./ExplainButton";

interface ExplainVisualizerProps {
  type: ExplainType;
  data: string | object;
}

export function ExplainVisualizer({ type, data }: ExplainVisualizerProps) {
  // If data is a string but looks like JSON (for PLAN/PIPELINE)
  // No JSON parsing needed as we display raw text for all types now
  // based on user feedback that FORMAT JSON output is incorrect/unwanted

  // Render all types as simple code block
  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b bg-muted/40">
        <Badge variant="outline">{type}</Badge>
      </div>
      <ScrollArea className="flex-1 bg-muted/20">
        <pre className="p-4 font-mono text-sm whitespace-pre-wrap">
          {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
        </pre>
      </ScrollArea>
    </div>
  );
}
