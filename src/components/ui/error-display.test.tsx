import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { ErrorDisplay as StandardErrorDisplay } from "./error-display";

describe("StandardErrorDisplay", () => {
  it("should render critical error with retry button", () => {
    render(
      <StandardErrorDisplay
        severity="critical"
        title="Connection Failed"
        message="Could not connect to ClickHouse"
        onRetry={() => {}}
      />
    );
    expect(screen.getByText("Connection Failed")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("should render high error with suggestions", () => {
    render(
      <StandardErrorDisplay
        severity="high"
        title="Query Timeout"
        message="Query took too long"
        suggestions={["Reduce time range", "Add filters"]}
      />
    );
    expect(screen.getByText("Reduce time range")).toBeInTheDocument();
  });
});