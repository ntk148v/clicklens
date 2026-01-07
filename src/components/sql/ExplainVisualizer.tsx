"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

import { Badge } from "@/components/ui/badge";
import type { ExplainType } from "./ExplainButton";
import { cn } from "@/lib/utils";

interface ExplainVisualizerProps {
  type: ExplainType;
  data: string | object;
}

function JsonTree({ data, level = 0 }: { data: any; level?: number }) {
  if (data === null) return <span className="text-muted-foreground">null</span>;
  if (data === undefined)
    return <span className="text-muted-foreground">undefined</span>;

  if (typeof data === "boolean") {
    return <span className="text-orange-500">{data.toString()}</span>;
  }

  if (typeof data === "number") {
    return <span className="text-blue-500">{data}</span>;
  }

  if (typeof data === "string") {
    return <span className="text-green-600 dark:text-green-400">"{data}"</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span>[]</span>;
    return (
      <div className="font-mono text-sm">
        <span>[</span>
        <div style={{ paddingLeft: "1.5rem" }}>
          {data.map((item, i) => (
            <div key={i}>
              <JsonTree data={item} level={level + 1} />
              {i < data.length - 1 && ","}
            </div>
          ))}
        </div>
        <span>]</span>
      </div>
    );
  }

  if (typeof data === "object") {
    if (Object.keys(data).length === 0) return <span>{"{}"}</span>;
    return (
      <div className="font-mono text-sm">
        <span>{"{"}</span>
        <div style={{ paddingLeft: "1.5rem" }}>
          {Object.entries(data).map(([key, value], i, arr) => (
            <div key={key} className="flex items-start">
              <span className="text-purple-600 dark:text-purple-400 mr-1">
                "{key}":
              </span>
              <div className="flex-1">
                <JsonTree data={value} level={level + 1} />
                {i < arr.length - 1 && ","}
              </div>
            </div>
          ))}
        </div>
        <span>{"}"}</span>
      </div>
    );
  }

  return <span>{String(data)}</span>;
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
