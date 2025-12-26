"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertCircle, Database, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    host: "localhost",
    port: "8123",
    username: "default",
    password: "",
    database: "default",
    protocol: "http" as const,
  });

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();
        if (data.isLoggedIn) {
          router.push("/");
        }
      } catch (err) {
        // Ignore errors, just show login form
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: formData.host,
          port: parseInt(formData.port, 10),
          username: formData.username,
          password: formData.password,
          database: formData.database,
          protocol: formData.protocol,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push("/");
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      setError(null);
    };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Database className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">ClickLens</CardTitle>
          <CardDescription>Connect to your ClickHouse database</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  placeholder="localhost"
                  value={formData.host}
                  onChange={handleChange("host")}
                  required
                />
              </div>
              <div>
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  placeholder="8123"
                  value={formData.port}
                  onChange={handleChange("port")}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="protocol">Protocol</Label>
              <select
                id="protocol"
                value={formData.protocol}
                onChange={handleChange("protocol")}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>

            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="default"
                value={formData.username}
                onChange={handleChange("username")}
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={handleChange("password")}
              />
            </div>

            <div>
              <Label htmlFor="database">Database</Label>
              <Input
                id="database"
                placeholder="default"
                value={formData.database}
                onChange={handleChange("database")}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </form>

          <p className="mt-4 text-xs text-center text-muted-foreground">
            Your credentials are used to connect to ClickHouse and are stored
            securely in an encrypted session cookie.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
