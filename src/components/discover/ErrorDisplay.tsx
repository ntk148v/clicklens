"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { ParsedError } from "@/lib/clickhouse/error-parser";

interface ErrorDisplayProps {
  error: ParsedError;
  query?: string;
  onRetry?: () => void;
  onFix?: () => void;
  onRefreshSchema?: () => void;
}

export function ErrorDisplay({
  error,
  query,
  onRetry,
  onFix,
  onRefreshSchema,
}: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="font-semibold">{error.message}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-2">
          {error.suggestions.length > 0 && (
            <ul className="space-y-1 text-sm">
              {error.suggestions.map((suggestion, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            {error.quickFixes.map((fix, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                onClick={fix.action}
                className="h-8 text-xs"
              >
                {fix.label}
              </Button>
            ))}
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="h-8 text-xs">
                Retry
              </Button>
            )}
            {onFix && (
              <Button variant="outline" size="sm" onClick={onFix} className="h-8 text-xs">
                Fix Syntax
              </Button>
            )}
            {onRefreshSchema && (
              <Button variant="outline" size="sm" onClick={onRefreshSchema} className="h-8 text-xs">
                Refresh Schema
              </Button>
            )}
          </div>

          {(error.details || query) && (
            <Collapsible open={showDetails} onOpenChange={setShowDetails} className="mt-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  {showDetails ? (
                    <>
                      <ChevronUp className="mr-1 h-3 w-3" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 h-3 w-3" />
                      Show Details
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {error.details && (
                  <div className="text-xs bg-muted/50 p-2 rounded font-mono">
                    {error.details}
                  </div>
                )}
                {query && (
                  <div className="text-xs bg-muted/50 p-2 rounded font-mono whitespace-pre-wrap break-all">
                    {query}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}