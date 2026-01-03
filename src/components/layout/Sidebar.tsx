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
  ChevronDown,
  LogOut,
  User,
  Gauge,
  GitBranch,
  Cog,
  HeartPulse,
  HardDrive,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useAuth } from "@/components/auth";

// Monitoring sub-navigation items
const monitoringItems = [
  {
    name: "Overview",
    href: "/monitoring/overview",
    icon: LayoutDashboard,
    description: "Cluster overview and key metrics",
  },
  {
    name: "Metrics",
    href: "/monitoring/metrics",
    icon: Gauge,
    description: "System metrics explorer",
  },
  {
    name: "Replication",
    href: "/monitoring/replication",
    icon: GitBranch,
    description: "Replica status and lag",
  },
  {
    name: "Operations",
    href: "/monitoring/operations",
    icon: Cog,
    description: "Merges and mutations",
  },
  {
    name: "Disks",
    href: "/monitoring/disks",
    icon: HardDrive,
    description: "Disk space and usage",
  },
  {
    name: "Keeper",
    href: "/monitoring/keeper",
    icon: Database,
    description: "ZooKeeper/Keeper status",
  },
];

// Main navigation items with permission requirements
const navigation = [
  {
    name: "SQL Console",
    href: "/sql",
    icon: Terminal,
    description: "Execute SQL queries",
    requiresPermission: null, // Always visible
  },
  {
    name: "Tables",
    href: "/tables",
    icon: Database,
    description: "Browse databases and tables",
    requiresPermission: null,
  },
  {
    name: "Queries",
    href: "/monitoring/queries",
    icon: Activity,
    description: "Monitor running queries",
    requiresPermission: "canViewProcesses" as const,
  },
  {
    name: "Monitoring",
    href: "/monitoring",
    icon: Server,
    description: "Cluster health and metrics",
    requiresPermission: "canViewCluster" as const,
    subItems: monitoringItems,
  },
  {
    name: "Access",
    href: "/access/users",
    icon: Users,
    description: "Users, roles, and grants",
    requiresPermission: "canManageUsers" as const,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [monitoringExpanded, setMonitoringExpanded] = useState(
    pathname.startsWith("/monitoring")
  );
  const { user, permissions, logout, isLoading } = useAuth();

  // Filter navigation based on permissions
  const visibleNavigation = navigation.filter((item) => {
    if (!item.requiresPermission) return true;
    if (!permissions) return false;
    return permissions[item.requiresPermission];
  });

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
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {visibleNavigation.map((item) => {
            const isActive =
              item.subItems
                ? pathname.startsWith(item.href) && !pathname.includes("/queries")
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            const hasSubItems = item.subItems && item.subItems.length > 0;

            // If it's a monitoring item with sub-items
            if (hasSubItems) {
              if (collapsed) {
                // When collapsed, show dropdown on hover
                return (
                  <DropdownMenu key={item.name}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full",
                              isActive
                                ? "bg-sidebar-accent text-primary"
                                : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                            )}
                          >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
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
                    <DropdownMenuContent side="right" align="start" className="w-48">
                      <DropdownMenuLabel>{item.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {item.subItems?.map((subItem) => (
                        <DropdownMenuItem key={subItem.name} asChild>
                          <Link
                            href={subItem.href}
                            className={cn(
                              "cursor-pointer",
                              pathname === subItem.href && "bg-accent"
                            )}
                          >
                            <subItem.icon className="w-4 h-4 mr-2" />
                            {subItem.name}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              // When expanded, show collapsible section
              return (
                <div key={item.name} className="space-y-1">
                  <button
                    onClick={() => setMonitoringExpanded(!monitoringExpanded)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full",
                      isActive
                        ? "bg-sidebar-accent text-primary"
                        : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 text-left">{item.name}</span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform",
                        monitoringExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {monitoringExpanded && (
                    <div className="ml-4 space-y-1 border-l border-sidebar-border pl-3">
                      {item.subItems?.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = pathname === subItem.href;

                        return (
                          <Link
                            key={subItem.name}
                            href={subItem.href}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                              isSubActive
                                ? "bg-sidebar-accent text-primary"
                                : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                            )}
                          >
                            <SubIcon className="w-4 h-4 flex-shrink-0" />
                            <span>{subItem.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Regular navigation item
            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-primary"
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

        {/* User dropdown and collapse toggle */}
        <div className="p-2 border-t border-sidebar-border space-y-2">
          {user && !isLoading && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <User className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && (
                    <span className="ml-2 truncate text-sm">
                      {user.username}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align={collapsed ? "center" : "start"}
                side="top"
                className="w-56"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.username}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.host} / {user.database}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
