import { toast } from "@/components/ui/use-toast";

/**
 * Standard API error response interface
 */
export interface ApiError {
  success: false;
  error: {
    code: number;
    message: string;
    type: string;
    userMessage?: string;
  };
}

/**
 * Enhanced fetch client with global error handling
 */
export async function fetchClient<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, options);

  // Handle errors based on status code
  if (!response.ok) {
    let errorMessage = "An unexpected error occurred";
    let userMessage = "";

    try {
      const errorData = (await response.json()) as ApiError;
      errorMessage = errorData.error?.message || response.statusText;
      userMessage = errorData.error?.userMessage || "";
    } catch {
      // Failed to parse JSON error, use status text
      errorMessage = response.statusText;
    }

    // Global error handling logic
    switch (response.status) {
      case 401:
        // Session expired / Unauthorized
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });

        // Wait a bit for the toast to be seen, or just redirect immediately
        // Ideally, we use the router, but we are in a utility function.
        // using window.location is a safe fallback for client-side navigation to login
        if (typeof window !== "undefined") {
          // Delay slightly to let toast render, or just redirect
          // For immediate security, redirecting is better.
          // App Router handling might be cleaner with a hook, but this function is a utility.
          window.location.href = `/login?callbackUrl=${encodeURIComponent(
            window.location.pathname + window.location.search,
          )}`;
        }
        break;

      case 403:
        toast({
          title: "Permission Denied",
          description:
            userMessage || "You don't have permission to perform this action.",
          variant: "destructive",
        });
        break;

      case 404:
        // Optional: don't always toast on 404, but for now we will as requested in plan (generic resource not found)
        // If the caller wants to handle 404 specifically, they should catch it.
        // For general API calls, a 404 usually implies a bug or missing data.
        // We will throw, and the caller can catch. Or we can toast.
        // Plan said: Toast "Resource not found".
        toast({
          title: "Resource Not Found",
          description:
            userMessage || "The requested resource could not be found.",
          variant: "destructive",
        });
        break;

      case 429:
        toast({
          title: "Too Many Requests",
          description: "Please try again later.",
          variant: "destructive",
        });
        break;

      case 500:
      case 502:
      case 503:
      case 504:
        toast({
          title: "Server Error",
          description: userMessage || "An internal server error occurred.",
          variant: "destructive",
        });
        break;

      case 400:
        toast({
          title: "Bad Request",
          description: userMessage || errorMessage || "Invalid request.",
          variant: "destructive",
        });
        break;

      default:
        // Don't toast for everything else automatically to avoid noise,
        // or toast a generic error.
        toast({
          title: "Error",
          description:
            userMessage ||
            errorMessage ||
            `Request failed with status ${response.status}`,
          variant: "destructive",
        });
        break;
    }

    // Throw an error so the caller knows it failed
    // We construct an Error object that looks like the API error if possible
    const error = new Error(errorMessage) as Error & {
      status: number;
      info?: unknown;
    };
    error.status = response.status;
    error.info = userMessage;
    throw error;
  }

  // Parse success response
  // If status is 204 No Content, return null/undefined
  if (response.status === 204) {
    return null as T;
  }

  try {
    const data = await response.json();

    // Check if it matches existing API structure
    if (
      data &&
      typeof data === "object" &&
      "success" in data &&
      "data" in data
    ) {
      return (data as { data: T }).data;
    }

    return data as T;
  } catch {
    // Not JSON
    return null as T;
  }
}
