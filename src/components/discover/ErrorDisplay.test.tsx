import { describe, it, expect, vi } from "bun:test";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ErrorDisplay } from "./ErrorDisplay";
import type { ParsedError } from "@/lib/clickhouse/error-parser";

describe("ErrorDisplay", () => {
  const mockError: ParsedError = {
    category: 'syntax',
    message: 'Syntax error: Missing closing parenthesis',
    suggestions: ['Check for unmatched parentheses'],
    quickFixes: [],
  };

  it("should render error message", () => {
    render(<ErrorDisplay error={mockError} />);
    expect(screen.getByText('Syntax error: Missing closing parenthesis')).toBeInTheDocument();
  });

  it("should render suggestions", () => {
    render(<ErrorDisplay error={mockError} />);
    expect(screen.getByText('Check for unmatched parentheses')).toBeInTheDocument();
  });

  it("should call onRetry when retry button clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorDisplay error={mockError} onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  it("should expand details when show details clicked", async () => {
    render(<ErrorDisplay error={{ ...mockError, details: 'Full error details' }} />);
    fireEvent.click(screen.getByText('Show Details'));
    await waitFor(() => {
      expect(screen.getByText('Full error details')).toBeInTheDocument();
    });
  });
});