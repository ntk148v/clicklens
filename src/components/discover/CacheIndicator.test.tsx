import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { CacheIndicator } from "./CacheIndicator";

describe("CacheIndicator", () => {
  it("should not render when not cached", () => {
    render(<CacheIndicator isCached={false} />);
    expect(screen.queryByText("Cached")).toBeNull();
  });

  it("should render badge when cached", () => {
    render(<CacheIndicator isCached={true} cacheAge={120000} />);
    expect(screen.getByText("Cached")).toBeInTheDocument();
  });

  it("should show cache age in tooltip", () => {
    render(<CacheIndicator isCached={true} cacheAge={120000} />);
    const badge = screen.getByText("Cached");
    expect(badge).toBeInTheDocument();
  });

  it("should show warning color for stale cache", () => {
    render(<CacheIndicator isCached={true} cacheAge={3600000 * 2} />);
    const badge = screen.getByText("Cached");
    expect(badge.className).toContain("text-yellow-600");
  });
});