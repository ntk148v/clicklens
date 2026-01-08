"use client";

import Link from "next/link";
import { Header } from "@/components/layout";
import { useAuth } from "@/components/auth";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Terminal,
  Database,
  Activity,
  Server,
  Users,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    title: "SQL Console",
    description:
      "Execute queries with syntax highlighting, auto-completion, and result exploration.",
    href: "/sql",
    icon: Terminal,
  },
  {
    title: "Table Explorer",
    description:
      "Browse databases, tables, and parts. View compression ratios and column stats.",
    href: "/tables",
    icon: Database,
  },
  {
    title: "Query Monitoring",
    description:
      "Monitor running queries, view query history, and analyze top resource consumers.",
    href: "/monitoring/queries",
    icon: Activity,
  },
  {
    title: "Cluster Health",
    description:
      "CPU, memory, merges, mutations, and Keeper status at a glance.",
    href: "/monitoring/cluster",
    icon: Server,
  },
  {
    title: "Access Control",
    description: "View users, roles, and grants. ClickHouse-native RBAC.",
    href: "/access/users",
    icon: Users,
  },
];

export default function HomePage() {
  const { permissions } = useAuth();

  const displayedFeatures = features.filter((feature) => {
    if (feature.title === "Access Control") {
      return permissions?.canManageUsers;
    }
    if (feature.title === "Query Monitoring") {
      // Align with sidebar logic
      return permissions?.canViewProcesses;
    }
    if (feature.title === "Cluster Health") {
      return permissions?.canViewCluster;
    }
    if (feature.title === "SQL Console") {
      return permissions?.canExecuteQueries;
    }
    if (feature.title === "Table Explorer") {
      return permissions?.canBrowseTables;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" />

      <div className="flex-1 p-6 space-y-8">
        {/* Hero Section */}
        <div className="space-y-4">
          <h2 className="text-3xl font-bold">
            Welcome to <span className="text-primary">ClickLens</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            A modern, open-source observability and analytics UI for ClickHouse.
            SQL-native, minimal, and fast. No magic metrics — every chart links
            back to its underlying SQL.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.title} href={feature.href}>
                <Card className="h-full hover:border-primary/50 transition-colors group cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Icon className="w-5 h-5" />
                      </div>
                      <CardTitle className="group-hover:text-primary transition-colors">
                        {feature.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                    <div className="mt-4 flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Get started</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Quick Info */}
        <div className="mt-8 p-4 rounded-lg bg-muted border">
          <h3 className="text-sm font-medium mb-2">Getting Started</h3>
          <p className="text-sm text-muted-foreground">
            You're connected to ClickHouse using your login credentials. Your
            permissions in this UI are determined by your ClickHouse user's
            grants and roles. Use the sidebar to navigate between features, or
            click any card above to get started.
          </p>
        </div>
      </div>
    </div>
  );
}
