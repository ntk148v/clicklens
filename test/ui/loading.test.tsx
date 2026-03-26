import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import {
  StreamingProgressIndicator,
  CountProgressIndicator,
  AggregationProgressIndicator,
  CombinedProgressIndicator,
  QueryLoadingState,
  LoadingSkeleton,
  InlineLoadingSpinner,
  LoadingOverlay,
} from "@/components/ui/loading";

describe("StreamingProgressIndicator", () => {
  it("should render nothing when not streaming", () => {
    const { container } = render(
      <StreamingProgressIndicator isStreaming={false} rowCount={0} totalHits={100} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render when streaming", () => {
    render(
      <StreamingProgressIndicator isStreaming={true} rowCount={50} totalHits={100} />
    );
    expect(screen.getByTestId("streaming-progress")).toBeInTheDocument();
  });

  it("should show correct row count", () => {
    render(
      <StreamingProgressIndicator isStreaming={true} rowCount={1234} totalHits={5000} />
    );
    expect(screen.getByText(/1,234/)).toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });

  it("should show streaming message", () => {
    render(
      <StreamingProgressIndicator isStreaming={true} rowCount={10} totalHits={100} />
    );
    expect(screen.getByText("Streaming data...")).toBeInTheDocument();
  });

  it("should handle unknown total hits", () => {
    render(
      <StreamingProgressIndicator isStreaming={true} rowCount={10} totalHits={-1} />
    );
    expect(screen.getByText(/10/)).toBeInTheDocument();
    expect(screen.queryByText(/of/)).not.toBeInTheDocument();
  });

  it("should have correct aria attributes", () => {
    render(
      <StreamingProgressIndicator isStreaming={true} rowCount={10} totalHits={100} />
    );
    const element = screen.getByRole("status");
    expect(element).toHaveAttribute("aria-label", "Streaming data");
  });
});

describe("CountProgressIndicator", () => {
  it("should render nothing when not counting", () => {
    const { container } = render(
      <CountProgressIndicator isCounting={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render when counting", () => {
    render(<CountProgressIndicator isCounting={true} />);
    expect(screen.getByTestId("count-progress")).toBeInTheDocument();
  });

  it("should show counting message", () => {
    render(<CountProgressIndicator isCounting={true} />);
    expect(screen.getByText(/Counting/)).toBeInTheDocument();
  });

  it("should show current count when provided", () => {
    render(<CountProgressIndicator isCounting={true} currentCount={42} />);
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it("should have correct aria attributes", () => {
    render(<CountProgressIndicator isCounting={true} />);
    const element = screen.getByRole("status");
    expect(element).toHaveAttribute("aria-label", "Counting documents");
  });
});

describe("AggregationProgressIndicator", () => {
  it("should render nothing when not aggregating", () => {
    const { container } = render(
      <AggregationProgressIndicator isAggregating={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render when aggregating", () => {
    render(<AggregationProgressIndicator isAggregating={true} />);
    expect(screen.getByTestId("aggregation-progress")).toBeInTheDocument();
  });

  it("should show histogram message", () => {
    render(
      <AggregationProgressIndicator isAggregating={true} aggregationType="histogram" />
    );
    expect(screen.getByText("Building histogram...")).toBeInTheDocument();
  });

  it("should show group-by message", () => {
    render(
      <AggregationProgressIndicator isAggregating={true} aggregationType="group-by" />
    );
    expect(screen.getByText("Grouping data...")).toBeInTheDocument();
  });

  it("should show custom aggregation message", () => {
    render(
      <AggregationProgressIndicator isAggregating={true} aggregationType="custom" />
    );
    expect(screen.getByText("Aggregating...")).toBeInTheDocument();
  });

  it("should have correct aria attributes", () => {
    render(<AggregationProgressIndicator isAggregating={true} />);
    const element = screen.getByRole("status");
    expect(element).toHaveAttribute("aria-label", "Aggregating data");
  });
});

describe("CombinedProgressIndicator", () => {
  const operations = [
    { id: "stream", label: "Streaming", isActive: true },
    { id: "count", label: "Counting", isActive: true },
    { id: "hist", label: "Histogram", isActive: false },
  ];

  it("should render nothing when no operations are active", () => {
    const { container } = render(
      <CombinedProgressIndicator
        operations={[
          { id: "a", label: "A", isActive: false },
          { id: "b", label: "B", isActive: false },
        ]}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render active operations only", () => {
    render(<CombinedProgressIndicator operations={operations} />);
    expect(screen.getByTestId("operation-stream")).toBeInTheDocument();
    expect(screen.getByTestId("operation-count")).toBeInTheDocument();
    expect(screen.queryByTestId("operation-hist")).not.toBeInTheDocument();
  });

  it("should show operation labels", () => {
    render(<CombinedProgressIndicator operations={operations} />);
    expect(screen.getByText("Streaming")).toBeInTheDocument();
    expect(screen.getByText("Counting")).toBeInTheDocument();
  });

  it("should show progress percentage when provided", () => {
    render(
      <CombinedProgressIndicator
        operations={[
          { id: "a", label: "Loading", isActive: true, progress: 75 },
        ]}
      />
    );
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("should have correct aria attributes", () => {
    render(<CombinedProgressIndicator operations={operations} />);
    const element = screen.getByRole("status");
    expect(element).toHaveAttribute("aria-label", "Multiple operations in progress");
  });
});

describe("QueryLoadingState", () => {
  it("should render nothing when not running", () => {
    const { container } = render(
      <QueryLoadingState isRunning={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render when running", () => {
    render(<QueryLoadingState isRunning={true} />);
    expect(screen.getByTestId("query-loading")).toBeInTheDocument();
  });

  it("should show executing message", () => {
    render(<QueryLoadingState isRunning={true} />);
    expect(screen.getByText("Executing query...")).toBeInTheDocument();
  });

  it("should show streamed rows when provided", () => {
    render(<QueryLoadingState isRunning={true} streamedRows={500} />);
    expect(screen.getByText(/500 rows received/)).toBeInTheDocument();
  });

  it("should have correct aria attributes", () => {
    render(<QueryLoadingState isRunning={true} />);
    const element = screen.getByRole("status");
    expect(element).toHaveAttribute("aria-label", "Query executing");
  });
});

describe("LoadingSkeleton", () => {
  it("should render skeleton", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
  });

  it("should render default rows and columns", () => {
    const { container } = render(<LoadingSkeleton />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should render custom rows and columns", () => {
    const { container } = render(<LoadingSkeleton rows={3} columns={2} />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(8);
  });

  it("should have correct aria attributes", () => {
    render(<LoadingSkeleton />);
    const element = screen.getByRole("status");
    expect(element).toHaveAttribute("aria-label", "Loading content");
  });
});

describe("InlineLoadingSpinner", () => {
  it("should render spinner", () => {
    render(<InlineLoadingSpinner />);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("should apply size classes", () => {
    const { container } = render(<InlineLoadingSpinner size="lg" />);
    const spinner = container.querySelector("svg");
    expect(spinner?.classList.contains("h-5")).toBe(true);
    expect(spinner?.classList.contains("w-5")).toBe(true);
  });
});

describe("LoadingOverlay", () => {
  it("should render children", () => {
    render(
      <LoadingOverlay isLoading={false}>
        <div>Content</div>
      </LoadingOverlay>
    );
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("should show overlay when loading", () => {
    render(
      <LoadingOverlay isLoading={true}>
        <div>Content</div>
      </LoadingOverlay>
    );
    expect(screen.getByTestId("loading-overlay")).toBeInTheDocument();
  });

  it("should hide overlay when not loading", () => {
    render(
      <LoadingOverlay isLoading={false}>
        <div>Content</div>
      </LoadingOverlay>
    );
    expect(screen.queryByTestId("loading-overlay")).not.toBeInTheDocument();
  });

  it("should show custom message", () => {
    render(
      <LoadingOverlay isLoading={true} message="Saving...">
        <div>Content</div>
      </LoadingOverlay>
    );
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });
});
