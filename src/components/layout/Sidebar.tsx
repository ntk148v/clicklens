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
  LogOut,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { useAuth } from "@/components/auth";

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
  const { user, logout, isLoading } = useAuth();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-sidebar-border">
          <Link href="/" className="flex items-center gap-2 overflow-hidden">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Database className="w-5 h-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="font-semibold text-sidebar-foreground whitespace-nowrap">
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
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
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
                    className="bg-popover border-border"
                  >
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.name}>{linkContent}</div>;
          })}
        </nav>

        {/* User info and logout */}
        <div className="p-2 border-t border-sidebar-border space-y-2">
          {user && !isLoading && (
            <>
              {!collapsed ? (
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate font-medium">
                      {user.username}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {user.host}:{user.database}
                  </div>
                </div>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center p-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-medium">{user.username}</p>
                    <p className="text-xs text-muted-foreground">{user.host}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Separator className="bg-sidebar-border" />

              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-full h-9 text-muted-foreground hover:text-red-600"
                      onClick={logout}
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Logout</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground hover:text-red-600"
                  onClick={logout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              )}
            </>
          )}

          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-center text-muted-foreground hover:text-foreground"
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
