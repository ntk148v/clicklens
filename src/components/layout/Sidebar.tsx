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
  HardDrive,
  LayoutDashboard,
  Zap,
  Clock,
  TrendingUp,
  Shield,
  ScrollText,
  Settings,
  Search,
  AlertTriangle,
  Github,
  BookOpen,
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

// Queries sub-navigation items
const queriesItems = [
  {
    name: "Running",
    href: "/queries/running",
    icon: Zap,
    description: "Live running queries",
  },
  {
    name: "History",
    href: "/queries/history",
    icon: Clock,
    description: "Historical query log",
  },
  {
    name: "Analytics",
    href: "/queries/analytics",
    icon: TrendingUp,
    description: "Query performance analytics",
  },
  {
    name: "Cache",
    href: "/queries/cache",
    icon: Database,
    description: "Query cache status",
  },
];

// Access sub-navigation items
const accessItems = [
  {
    name: "Users",
    href: "/access/users",
    icon: User,
    description: "Manage database users",
  },
  {
    name: "Roles",
    href: "/access/roles",
    icon: Shield,
    description: "Manage roles and permissions",
  },
];

// Settings sub-navigation items
const settingsItems = [
  {
    name: "Session",
    href: "/settings/session",
    icon: User,
    description: "User session settings",
  },
  {
    name: "Server",
    href: "/settings/server",
    icon: Server,
    description: "Server configuration",
  },
];

// Logging sub-navigation items
const loggingItems = [
  {
    name: "Server Logs",
    href: "/logging/server",
    icon: ScrollText,
    description: "General server logs",
    requiresPermission: "canViewServerLogs" as const,
  },
  {
    name: "Crash Logs",
    href: "/logging/crash",
    icon: AlertTriangle,
    description: "Server crash history",
    requiresPermission: "canViewCrashLogs" as const,
  },
  {
    name: "Session Log",
    href: "/logging/session",
    icon: User,
    description: "Login / logout history",
    requiresPermission: "canViewSessionLogs" as const,
  },
];

// Main navigation items with permission requirements
const navigation = [
  {
    name: "Discover",
    href: "/discover",
    icon: Search,
    description: "Explore logs and events",
    requiresPermission: "canDiscover" as const,
  },
  {
    name: "SQL Console",
    href: "/sql",
    icon: Terminal,
    description: "Execute SQL queries",
    requiresPermission: "canExecuteQueries" as const,
  },
  {
    name: "Tables",
    href: "/tables",
    icon: Database,
    description: "Browse databases and tables",
    requiresPermission: "canBrowseTables" as const,
  },
  {
    name: "Queries",
    href: "/queries",
    icon: Activity,
    description: "Monitor running queries",
    requiresPermission: "canViewProcesses" as const,
    subItems: queriesItems,
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
    name: "Logging",
    href: "/logging",
    icon: ScrollText,
    description: "Search server logs",
    requiresPermission: "canViewSystemLogs" as const, // Updated permission
    subItems: loggingItems,
  },
  {
    name: "Access",
    href: "/access",
    icon: Users,
    description: "Users, roles, and grants",
    requiresPermission: "canManageUsers" as const,
    subItems: accessItems,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    description: "System and server settings",
    requiresPermission: "canViewSettings" as const,
    subItems: settingsItems,
  },
];

// Resource navigation items
const resourcesItems = [
  {
    name: "Documentation",
    href: "https://github.com/ntk148v/clicklens#readme",
    icon: BookOpen,
    description: "Read the documentation",
    external: true,
  },
  {
    name: "GitHub",
    href: "https://github.com/ntk148v/clicklens",
    icon: Github,
    description: "View source code",
    external: true,
  },
  {
    name: "v" + process.env.NEXT_PUBLIC_APP_VERSION,
    href:
      "https://github.com/ntk148v/clicklens/releases/tag/v" +
      process.env.NEXT_PUBLIC_APP_VERSION,
    icon: ScrollText,
    description: "View version",
    requiresPermission: "canViewVersion" as const,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    () => ({
      Monitoring: pathname.startsWith("/monitoring"),
      Queries: pathname.startsWith("/queries"),
      Access: pathname.startsWith("/access"),
      Settings: pathname.startsWith("/settings"),
      Logging: pathname.startsWith("/logging"),
    })
  );
  const { user, permissions, logout, isLoading } = useAuth();

  const toggleExpanded = (name: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg" />
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
            const isActive = item.subItems
              ? pathname.startsWith(item.href)
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            // Filter sub-items based on permissions
            const visibleSubItems = item.subItems?.filter((subItem) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const req = (subItem as any).requiresPermission;
              if (!req) return true;
              if (!permissions) return false;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return (permissions as any)[req];
            });

            const hasSubItems = visibleSubItems && visibleSubItems.length > 0;
            const isExpanded = expandedItems[item.name];

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
                    <DropdownMenuContent
                      side="right"
                      align="start"
                      className="w-48"
                    >
                      <DropdownMenuLabel>{item.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {visibleSubItems?.map((subItem) => (
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
                    onClick={() => toggleExpanded(item.name)}
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
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="ml-4 space-y-1 border-l border-sidebar-border pl-3">
                      {visibleSubItems?.map((subItem) => {
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

        {/* Resources */}
        <div className="p-2 border-t border-sidebar-border space-y-1">
          {resourcesItems.map((item) => {
            const Icon = item.icon;
            const linkContent = (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </a>
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
        </div>

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
                <DropdownMenuItem asChild>
                  <Link
                    href="/profile"
                    className="flex items-center cursor-pointer"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Link>
                </DropdownMenuItem>
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
