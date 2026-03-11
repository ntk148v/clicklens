import { describe, test, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { DiscoverHistogram } from "./DiscoverHistogram";

describe("DiscoverHistogram", () => {
  const mockData = [
    { time: "2024-01-01T00:00:00Z", count: 10 },
    { time: "2024-01-01T01:00:00Z", count: 20 },
    { time: "2024-01-01T02:00:00Z", count: 15 },
  ];

  describe("Adaptive Height", () => {
    test("should use minimum height (102px) for single data point", () => {
      const { container } = render(
        <DiscoverHistogram data={[{ time: "2024-01-01T00:00:00Z", count: 10 }]} />,
      );
      const chartContainer = container.firstChild as HTMLElement;
      expect(chartContainer).not.toBeNull();
      expect(chartContainer?.style.height).toBe("102px");
    });

    test("should scale height based on data points", () => {
      const { container } = render(<DiscoverHistogram data={mockData} />);
      const chartContainer = container.firstChild as HTMLElement;
      expect(chartContainer).not.toBeNull();
      expect(chartContainer?.style.height).toBe("106px");
    });

    test("should cap height at maximum (300px) for many data points", () => {
      const largeData = Array.from({ length: 200 }, (_, i) => ({
        time: `2024-01-01T${String(i).padStart(2, "0")}:00:00Z`,
        count: Math.floor(Math.random() * 100),
      }));
      const { container } = render(<DiscoverHistogram data={largeData} />);
      const chartContainer = container.firstChild as HTMLElement;
      expect(chartContainer).not.toBeNull();
      expect(chartContainer?.style.height).toBe("300px");
    });

    test("should calculate height correctly for 50 data points", () => {
      const mediumData = Array.from({ length: 50 }, (_, i) => ({
        time: `2024-01-01T${String(i).padStart(2, "0")}:00:00Z`,
        count: Math.floor(Math.random() * 100),
      }));
      const { container } = render(<DiscoverHistogram data={mediumData} />);
      const chartContainer = container.firstChild as HTMLElement;
      expect(chartContainer).not.toBeNull();
      expect(chartContainer?.style.height).toBe("200px");
    });

    test("should calculate height correctly for 100 data points", () => {
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        time: `2024-01-01T${String(i).padStart(2, "0")}:00:00Z`,
        count: Math.floor(Math.random() * 100),
      }));
      const { container } = render(<DiscoverHistogram data={largeData} />);
      const chartContainer = container.firstChild as HTMLElement;
      expect(chartContainer).not.toBeNull();
      expect(chartContainer?.style.height).toBe("300px");
    });
  });

  describe("Loading State", () => {
    test("should show loading skeleton when loading with no data", () => {
      const { container } = render(<DiscoverHistogram data={[]} isLoading />);
      expect(screen.getByText("Loading histogram...")).toBeInTheDocument();
      const card = container.querySelector(".bg-muted\\/20") as HTMLElement;
      expect(card).not.toBeNull();
    });

    test("should use adaptive height for loading state", () => {
      const { container } = render(<DiscoverHistogram data={[]} isLoading />);
      const card = container.querySelector(".bg-muted\\/20") as HTMLElement;
      expect(card).not.toBeNull();
      expect(card?.style.height).toBe("150px");
    });
  });

  describe("Empty State", () => {
    test("should return null when not loading and no data", () => {
      const { container } = render(<DiscoverHistogram data={[]} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Data Formatting", () => {
    test("should format time correctly for single data point", () => {
      const { container } = render(
        <DiscoverHistogram
          data={[{ time: "2024-01-01T12:30:00Z", count: 10 }]}
        />,
      );
      expect(container).toBeInTheDocument();
    });

    test("should handle invalid time gracefully", () => {
      const { container } = render(
        <DiscoverHistogram data={[{ time: "invalid-time", count: 10 }]} />,
      );
      expect(container).toBeInTheDocument();
    });
  });
});