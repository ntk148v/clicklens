import { Header } from "@/components/layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Users, Shield, Key } from "lucide-react";

export default function UsersPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Access Control" />

      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-full bg-ch-yellow/10 flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-ch-yellow" />
          </div>
          <h2 className="text-2xl font-bold text-ch-text mb-4">
            Access Control
          </h2>
          <p className="text-ch-muted mb-8">
            View and manage users, roles, and grants using ClickHouse native
            RBAC.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <Card className="bg-ch-surface border-ch-border">
              <CardHeader className="pb-2">
                <Users className="w-5 h-5 text-ch-yellow mb-2" />
                <CardTitle className="text-sm text-ch-text">Users</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  View user accounts and their authentication settings from
                  system.users
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-ch-surface border-ch-border">
              <CardHeader className="pb-2">
                <Shield className="w-5 h-5 text-ch-yellow mb-2" />
                <CardTitle className="text-sm text-ch-text">Roles</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Browse roles and role assignments from system.roles
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-ch-surface border-ch-border">
              <CardHeader className="pb-2">
                <Key className="w-5 h-5 text-ch-yellow mb-2" />
                <CardTitle className="text-sm text-ch-text">Grants</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  View permission grants and privileges from system.grants
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-ch-muted mt-8 p-4 rounded-lg bg-ch-surface border border-ch-border">
            🚧 Coming soon in Phase 7 — Use the SQL Console to query{" "}
            <code className="text-ch-yellow">system.users</code>,{" "}
            <code className="text-ch-yellow">system.roles</code>, and{" "}
            <code className="text-ch-yellow">system.grants</code> directly.
          </p>
        </div>
      </div>
    </div>
  );
}
