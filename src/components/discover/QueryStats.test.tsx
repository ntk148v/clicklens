import { describe, test, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { QueryStats } from "./QueryStats";

describe("QueryStats", () => {
  test("renders nothing when stats is null", () => {
    const { container } = render(<QueryStats stats={null} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders execution time", () => {
    const stats = {
      executionTime: 1234,
      rowsScanned: 1000,
      rowsReturned: 100,
    };
    render(<QueryStats stats={stats} />);
    expect(screen.getByText("1.23s")).toBeInTheDocument();
  });

  test("renders execution time in milliseconds for small values", () => {
    const stats = {
      executionTime: 123,
      rowsScanned: 1000,
      rowsReturned: 100,
    };
    render(<QueryStats stats={stats} />);
    expect(screen.getByText("123ms")).toBeInTheDocument();
  });

  test("renders rows returned", () => {
    const stats = {
      executionTime: 1000,
      rowsScanned: 1000,
      rowsReturned: 100,
    };
    render(<QueryStats stats={stats} />);
    expect(screen.getByText("100 rows")).toBeInTheDocument();
  });

  test("formats large row numbers with K suffix", () => {
    const stats = {
      executionTime: 1000,
      rowsScanned: 10000,
      rowsReturned: 5000,
    };
    render(<QueryStats stats={stats} />);
    expect(screen.getByText("5.0K rows")).toBeInTheDocument();
  });

  test("formats very large row numbers with M suffix", () => {
    const stats = {
      executionTime: 1000,
      rowsScanned: 2000000,
      rowsReturned: 1500000,
    };
    render(<QueryStats stats={stats} />);
    expect(screen.getByText("1.5M rows")).toBeInTheDocument();
  });

  test("shows rows scanned when different from rows returned", () => {
    const stats = {
      executionTime: 1000,
      rowsScanned: 10000,
      rowsReturned: 100,
    };
    render(<QueryStats stats={stats} />);
    expect(screen.getByText("10.0K scanned")).toBeInTheDocument();
  });

  test("does not show rows scanned when equal to rows returned", () => {
    const stats = {
      executionTime: 1000,
      rowsScanned: 100,
      rowsReturned: 100,
    };
    render(<QueryStats stats={stats} />);
    expect(screen.queryByText(/scanned/)).not.toBeInTheDocument();
  });

  test("shows cache hit indicator when cacheHit is true", () => {
    const stats = {
      executionTime: 1000,
      rowsScanned: 100,
      rowsReturned: 100,
      cacheHit: true,
    };
    render(<QueryStats stats={stats} />);
    expect(screen.getByText("Cached")).toBeInTheDocument();
  });

  test("does not show cache hit indicator when cacheHit is false", () => {
    const stats = {
      executionTime: 1000,
      rowsScanned: 100,
      rowsReturned: 100,
      cacheHit: false,
    };
    render(<QueryStats stats={stats} />);
    expect(screen.queryByText("Cached")).not.toBeInTheDocument();
  });

  test("does not show cache hit indicator when cacheHit is undefined", () => {
    const stats = {
      executionTime: 1000,
      rowsScanned: 100,
      rowsReturned: 100,
    };
    render(<QueryStats stats={stats} />);
    expect(screen.queryByText("Cached")).not.toBeInTheDocument();
  });

  test("renders all metrics together", () => {
    const stats = {
      executionTime: 2345,
      rowsScanned: 50000,
      rowsReturned: 1000,
      cacheHit: true,
    };
    render(<QueryStats stats={stats} />);
    expect(screen.getByText("2.35s")).toBeInTheDocument();
    expect(screen.getByText("1.0K rows")).toBeInTheDocument();
    expect(screen.getByText("50.0K scanned")).toBeInTheDocument();
    expect(screen.getByText("Cached")).toBeInTheDocument();
  });

  test("applies custom className", () => {
    const stats = {
      executionTime: 1000,
      rowsScanned: 100,
      rowsReturned: 100,
    };
    const { container } = render(
      <QueryStats stats={stats} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});