"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { XCircle, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface StandardErrorDisplayProps {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  suggestions?: string[];
  onRetry?: () => void;
  onDismiss?: () => void;
  details?: string;
}

const severityConfig = {
  critical: {
    icon: XCircle,
    variant: 'destructive' as const,
    className: 'border-red-500/50 bg-red-500/10',
  },
  high: {
    icon: AlertTriangle,
    variant: 'destructive' as const,
    className: 'border-orange-500/50 bg-orange-500/10',
  },
  medium: {
    icon: AlertTriangle,
    variant: 'default' as const,
    className: 'border-yellow-500/50 bg-yellow-500/10',
  },
  low: {
    icon: Info,
    variant: 'default' as const,
    className: 'border-blue-500/50 bg-blue-500/10',
  },
};

export function ErrorDisplay({
  severity,
  title,
  message,
  suggestions,
  onRetry,
  onDismiss,
  details,
}: StandardErrorDisplayProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <Alert variant={config.variant} className={cn(config.className)}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="font-semibold">{title}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-2">
          <p>{message}</p>

          {suggestions && suggestions.length > 0 && (
            <ul className="space-y-1 text-sm">
              {suggestions.map((suggestion, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="h-8 text-xs">
                <RefreshCw className="mr-1 h-3 w-3" />
                Retry
              </Button>
            )}
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss} className="h-8 text-xs">
                Dismiss
              </Button>
            )}
          </div>

          {details && (
            <div className="mt-2 text-xs bg-muted/50 p-2 rounded font-mono">
              {details}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}