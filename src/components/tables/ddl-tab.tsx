"use client";

import { useState, useEffect } from "react";
import { Loader2, Code, Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { copyToClipboard } from "@/lib/utils";

interface DdlTabProps {
  database: string;
  table: string;
}

export function DdlTab({ database, table }: DdlTabProps) {
  const [ddl, setDdl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchDdl() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/clickhouse/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sql: `SHOW CREATE TABLE \`${database}\`.\`${table}\``,
          }),
        });

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          setError("Failed to read response");
          return;
        }

        const decoder = new TextDecoder();
        let result = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          result += decoder.decode(value, { stream: true });
        }

        // Parse NDJSON response
        const lines = result.trim().split("\n");
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === "data" && parsed.data) {
              // The DDL is the first column of the first row
              const row = parsed.data[0];
              if (Array.isArray(row) && row[0]) {
                setDdl(row[0] as string);
                break;
              }
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch DDL");
      } finally {
        setIsLoading(false);
      }
    }

    fetchDdl();
  }, [database, table]);

  const handleCopy = async () => {
    if (ddl) {
      const success = await copyToClipboard(ddl);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        {error}
      </div>
    );
  }

  if (!ddl) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Code className="h-12 w-12 mb-4 opacity-50" />
        <p>Could not retrieve table DDL</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Card className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <ScrollArea className="h-[500px]">
          <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-all">
            {ddl}
          </pre>
        </ScrollArea>
      </Card>
    </div>
  );
}
