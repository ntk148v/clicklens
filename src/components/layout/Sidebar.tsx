"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Database,
  Terminal,
  Activity,
  Server,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";

const navigation = [
  {
    name: "SQL Console",
    href: "/sql",
    icon: Terminal,
    description: "Execute SQL queries",
  },
  {
    name: "Tables",
    href: "/tables",
    icon: Database,
    description: "Browse databases and tables",
  },
  {
    name: "Queries",
    href: "/monitoring/queries",
    icon: Activity,
    description: "Monitor running queries",
  },
  {
    name: "Cluster",
    href: "/monitoring/cluster",
    icon: Server,
    description: "Cluster health and metrics",
  },
  {
    name: "Access",
    href: "/access/users",
    icon: Users,
    description: "Users, roles, and grants",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-full bg-ch-surface border-r border-ch-border transition-all duration-200",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-ch-border">
          <Link href="/" className="flex items-center gap-2 overflow-hidden">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-ch-yellow flex items-center justify-center">
              <Database className="w-5 h-5 text-ch-bg" />
            </div>
            {!collapsed && (
              <span className="font-semibold text-ch-text whitespace-nowrap">
                ClickLens
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-ch-yellow/10 text-ch-yellow"
                    : "text-ch-muted hover:text-ch-text hover:bg-ch-border/50"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="bg-ch-surface border-ch-border"
                  >
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-ch-muted">{item.description}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.name}>{linkContent}</div>;
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-ch-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-center text-ch-muted hover:text-ch-text hover:bg-ch-border/50"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
