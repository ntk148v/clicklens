"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bookmark, Play, Trash2, Calendar, FileCode } from "lucide-react";
import { useTabsStore } from "@/lib/store/tabs";
import { type SavedQuery } from "@/app/api/saved-queries/route";

interface SavedQueriesProps {
  onSelect?: (sql: string) => void;
}

export function SavedQueries({ onSelect }: SavedQueriesProps) {
  const { addTab } = useTabsStore();
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueries = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saved-queries");
      const data = await res.json();
      if (data.success) {
        setQueries(data.data);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to fetch saved queries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueries();
  }, []);

  const handleSelect = (sql: string, name: string) => {
    if (onSelect) {
      onSelect(sql);
    } else {
      addTab({ sql, name: name });
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>;
  }

  if (queries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Bookmark className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">No saved queries</p>
        <p className="text-xs mt-1">Save queries to access them here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Bookmark className="w-4 h-4" />
          Saved Queries
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={fetchQueries}
        >
           <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full opacity-50" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {queries.map((query) => (
            <div
              key={query.id}
              className="group relative flex flex-col gap-2 pb-4 border-b last:border-0 last:pb-0"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{query.name}</span>
                <span className="text-xs text-muted-foreground">
                    {new Date(query.created_at).toLocaleDateString()}
                </span>
              </div>
              
              {query.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                      {query.description}
                  </p>
              )}

              {/* SQL Preview */}
              <div className="bg-muted/50 p-2 rounded text-xs font-mono line-clamp-3 text-muted-foreground">
                  {query.sql}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-1">
                <Button 
                    size="sm" 
                    variant="secondary" 
                    className="h-7 text-xs w-full"
                    onClick={() => handleSelect(query.sql, query.name)}
                >
                    <Play className="w-3 h-3 mr-1" />
                    Load
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
