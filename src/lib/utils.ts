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
 * Format a DateTime value - converts UTC to user's local timezone for display.
 * ClickHouse stores all timestamps in UTC; this function handles the conversion
 * to the user's local timezone while preserving ISO-like format and precision.
 *
 * Preserves fractional seconds (microseconds for DateTime64) from the original input.
 *
 * @param value - The datetime value (ISO string, timestamp, or Date object)
 * @returns Formatted datetime string in ISO format with local timezone
 *          Example: 2026-01-15T16:36:29.345421+07:00 (preserves microseconds)
 */
export function formatDateTime(
  value: string | number | Date | null | undefined
): string {
  if (value === null || value === undefined) return "—";

  // Extract fractional seconds from original string if present (for DateTime64)
  let fractionalSeconds = "";
  if (typeof value === "string") {
    // Match fractional seconds: .123, .123456, etc.
    const match = value.match(/\.(\d+)/);
    if (match) {
      fractionalSeconds = "." + match[1];
    }
  }

  // Parse to Date object
  let date: Date;

  if (typeof value === "string") {
    // Parse ISO string from ClickHouse (stored in UTC)
    date = new Date(value);
  } else if (typeof value === "number") {
    date = new Date(value);
  } else if (value instanceof Date) {
    date = value;
  } else {
    return String(value);
  }

  // Check for invalid date
  if (isNaN(date.getTime())) {
    return typeof value === "string" ? value : String(value);
  }

  // Format in ISO-like format with local timezone
  // Preserves original fractional seconds precision
  const pad = (n: number) => n.toString().padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  // Get timezone offset in ±HH:MM format
  const tzOffset = -date.getTimezoneOffset();
  const tzSign = tzOffset >= 0 ? "+" : "-";
  const tzHours = pad(Math.floor(Math.abs(tzOffset) / 60));
  const tzMinutes = pad(Math.abs(tzOffset) % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${fractionalSeconds}${tzSign}${tzHours}:${tzMinutes}`;
}

/**
 * Format a Date-only value (no time component).
 * For ClickHouse Date/Date32 columns, returns YYYY-MM-DD format.
 *
 * @param value - The date value (ISO string, timestamp, or Date object)
 * @returns Formatted date string: YYYY-MM-DD
 */
export function formatDate(
  value: string | number | Date | null | undefined
): string {
  if (value === null || value === undefined) return "—";

  // Parse to Date object
  let date: Date;

  if (typeof value === "string") {
    // Handle date-only strings (YYYY-MM-DD) which don't have timezone info
    // These should be displayed as-is without conversion
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    date = new Date(value);
  } else if (typeof value === "number") {
    date = new Date(value);
  } else if (value instanceof Date) {
    date = value;
  } else {
    return String(value);
  }

  // Check for invalid date
  if (isNaN(date.getTime())) {
    return typeof value === "string" ? value : String(value);
  }

  // Format as YYYY-MM-DD
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}
