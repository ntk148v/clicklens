"use client";

import { cn } from "@/lib/utils";

interface JsonViewerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  className?: string;
  initialExpanded?: boolean;
}

export function JsonViewer({ data, className }: JsonViewerProps) {
  if (data === null || data === undefined) {
    return <span className="text-muted-foreground">null</span>;
  }

  // If simple type
  if (typeof data !== "object") {
    const isString = typeof data === "string";
    const isNumber = typeof data === "number";
    const isBoolean = typeof data === "boolean";

    return (
      <span
        className={cn(
          "font-mono text-sm break-all",
          isString && "text-green-600 dark:text-green-400",
          isNumber && "text-blue-600 dark:text-blue-400",
          isBoolean && "text-purple-600 dark:text-purple-400",
          className
        )}
      >
        {isString ? `"${data}"` : String(data)}
      </span>
    );
  }

  // Attempt to parse if it's a JSON string
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed === "object") {
        return <JsonTree data={parsed} root />;
      }
    } catch {
      // Not JSON, just string
    }
  }

  return <JsonTree data={data} root />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function JsonTree({ data, root = false }: { data: any; root?: boolean }) {
  if (Array.isArray(data)) {
    if (data.length === 0)
      return <span className="text-muted-foreground">[]</span>;
    return (
      <div className={cn("font-mono text-xs", root ? "" : "ml-4")}>
        <span className="text-muted-foreground">[</span>
        <div className="pl-2 border-l border-muted/50">
          {data.map((item, i) => (
            <div key={i} className="my-0.5">
              <JsonTree data={item} />
              {i < data.length - 1 && (
                <span className="text-muted-foreground">,</span>
              )}
            </div>
          ))}
        </div>
        <span className="text-muted-foreground">]</span>
      </div>
    );
  }

  if (typeof data === "object" && data !== null) {
    const keys = Object.keys(data);
    if (keys.length === 0)
      return <span className="text-muted-foreground">{"{}"}</span>;

    return (
      <div className={cn("font-mono text-xs", root ? "" : "pl-4")}>
        {!root && <span className="text-muted-foreground">{"{"}</span>}
        <div className={cn(root ? "" : "pl-2 border-l border-muted/50")}>
          {keys.map((key) => (
            <div key={key} className="flex items-start my-0.5">
              <span className="text-sky-600 dark:text-sky-400 mr-1 select-none">
                "{key}":
              </span>
              <JsonViewer data={data[key]} />
            </div>
          ))}
        </div>
        {!root && <span className="text-muted-foreground">{"}"}</span>}
      </div>
    );
  }

  return <JsonViewer data={data} />;
}
