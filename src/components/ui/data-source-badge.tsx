import { cn } from "@/lib/utils";

interface DataSourceBadgeProps {
  sources: string[];
  description?: string;
  className?: string;
  clusterAware?: boolean;
}

export function DataSourceBadge({
  sources,
  description,
  className,
  clusterAware,
}: DataSourceBadgeProps) {
  return (
    <div className={cn("p-4 rounded-lg bg-muted border", className)}>
      <p className="text-xs text-muted-foreground">
        Data sourced from{" "}
        {sources.map((source, index) => (
          <span key={source}>
            <code className="text-primary">{source}</code>
            {index < sources.length - 1
              ? index === sources.length - 2
                ? " and "
                : ", "
              : ""}
          </span>
        ))}
        .{clusterAware && " Cluster-aware: showing all nodes."}
        {description && ` ${description}`}
      </p>
    </div>
  );
}
