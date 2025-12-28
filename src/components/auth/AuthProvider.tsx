"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
  username: string;
}

interface UserPermissions {
  canViewAccess: boolean;
}

interface AuthContextType {
  user: User | null;
  permissions: UserPermissions;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    credentials: LoginCredentials
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface LoginCredentials {
  username: string;
  password: string;
}

const defaultPermissions: UserPermissions = {
  canViewAccess: false,
};

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] =
    useState<UserPermissions>(defaultPermissions);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session");
      const data = await response.json();

      if (data.isLoggedIn && data.user) {
        setUser(data.user);
        if (data.permissions) {
          setPermissions(data.permissions);
        } else {
          setPermissions(defaultPermissions);
        }
      } else {
        setUser(null);
        setPermissions(defaultPermissions);
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
      setUser(null);
      setPermissions(defaultPermissions);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Redirect to login if not authenticated (except on login page)
  useEffect(() => {
    if (!isLoading && !user && pathname !== "/login") {
      router.push("/login");
    }
  }, [isLoading, user, pathname, router]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });

        const data = await response.json();

        if (data.success) {
          await refresh();
          router.push("/");
          return { success: true };
        } else {
          return { success: false, error: data.error };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Login failed",
        };
      }
    },
    [refresh, router]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setPermissions(defaultPermissions);
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
