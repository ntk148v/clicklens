"use client";

import { useAuth } from "@/components/auth";
import { Header } from "@/components/layout";
import { PasswordChangeForm } from "@/components/profile/PasswordChangeForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="User Profile" />

      <div className="flex-1 p-6 overflow-y-auto w-full">
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Details about your current session and connection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Username
                  </p>
                  <p className="text-sm font-medium">{user.username}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Database
                  </p>
                  <p className="text-sm font-medium">{user.database}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Host
                  </p>
                  <p className="text-sm font-medium">{user.host}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>
                Manage your password and security ensure settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordChangeForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
