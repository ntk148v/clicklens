import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "@/components/ui/use-toast";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateUUID() {
  // Check if crypto.randomUUID is available (secure context + supported browser/node)
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Fallback for insecure contexts or older environments
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Fallback copy using execCommand with a textarea element.
 * This works in HTTP contexts where Clipboard API isn't available.
 */
function fallbackCopyToClipboard(text: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  // Store the currently focused element to restore later
  const activeElement = document.activeElement as HTMLElement;

  // Create a textarea element
  const textArea = document.createElement("textarea");
  textArea.value = text;

  // Make it visible but tiny - some browsers require visibility for execCommand
  // Position it off-screen but not hidden
  textArea.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    padding: 0;
    border: none;
    outline: none;
    box-shadow: none;
    background: transparent;
    font-size: 12pt;
    overflow: hidden;
  `;

  // Prevent iOS keyboard from jumping
  textArea.contentEditable = "true";
  textArea.readOnly = false;

  document.body.appendChild(textArea);

  // Focus the textarea
  textArea.focus();

  // Select the text - different methods for different browsers
  if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
    // iOS Safari specific handling
    const editable = textArea.contentEditable;
    const readOnly = textArea.readOnly;

    textArea.contentEditable = "true";
    textArea.readOnly = false;

    const range = document.createRange();
    range.selectNodeContents(textArea);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    textArea.setSelectionRange(0, 999999);
    textArea.contentEditable = editable;
    textArea.readOnly = readOnly;
  } else {
    // Standard selection
    textArea.select();
    textArea.setSelectionRange(0, text.length);
  }

  let success = false;
  try {
    success = document.execCommand("copy");
    if (!success) {
      console.warn("execCommand returned false");
    }
  } catch (err) {
    console.warn("execCommand copy failed:", err);
    success = false;
  }

  // Clean up
  document.body.removeChild(textArea);

  // Restore focus
  if (activeElement && typeof activeElement.focus === "function") {
    activeElement.focus();
  }

  return success;
}

/**
 * Copy text to clipboard with fallback for non-secure contexts.
 * Works in both HTTPS and HTTP environments.
 * Shows toast notification on success/failure.
 */
export async function copyToClipboard(
  text: string,
  options?: { showToast?: boolean }
): Promise<boolean> {
  const showToast = options?.showToast ?? true;

  let success = false;

  // Try the modern Clipboard API first (requires secure context)
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function" &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(text);
      success = true;
    } catch (err) {
      console.warn("Clipboard API failed, trying fallback:", err);
      // Try fallback
      success = fallbackCopyToClipboard(text);
    }
  } else {
    // Use fallback for non-secure contexts
    success = fallbackCopyToClipboard(text);
  }

  if (showToast) {
    if (success) {
      toast({
        title: "Copied to clipboard",
        description: "Content has been copied to your clipboard.",
      });
    } else {
      toast({
        title: "Failed to copy",
        description:
          "Unable to copy to clipboard. Please select the text and copy manually.",
        variant: "destructive",
      });
    }
  }

  return success;
}

/**
 * Format a DateTime value - keeps original ISO format for consistency.
 * ClickHouse returns ISO strings like "2024-01-01T10:00:00Z" which are kept as-is.
 * This preserves timezone information and provides consistent display.
 */
export function formatDateTime(
  value: string | number | Date | null | undefined
): string {
  if (value === null || value === undefined) return "—";

  // If it's already a string (common case from ClickHouse), return as-is
  if (typeof value === "string") {
    return value;
  }

  // For Date objects, convert to ISO string
  if (value instanceof Date) {
    return value.toISOString();
  }

  // For numbers (timestamps), convert to ISO string
  if (typeof value === "number") {
    try {
      return new Date(value).toISOString();
    } catch {
      return String(value);
    }
  }

  return String(value);
}
