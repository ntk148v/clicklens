/**
 * Performance Type Definitions
 *
 * Types for benchmarking, metrics, and performance monitoring.
 */

export interface BenchmarkResult {
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
  };
  queryPerformance: {
    discoverQueries: QueryMetric[];
    sqlQueries: QueryMetric[];
    slowestQueries: SlowQuery[];
  };
  renderPerformance: {
    discoverPage: RenderMetric;
    sqlConsolePage: RenderMetric;
  };
  scrollPerformance: ScrollMetrics;
  memoryUsage: MemoryMetric;
}

export interface QueryMetric {
  name: string;
  description: string;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  samples: number;
}

export interface SlowQuery {
  rank: number;
  query: string;
  category: string;
  avgTime: number;
  characteristics: string[];
}

export interface RenderMetric {
  initialLoad: number;
  timeToInteractive: number;
  firstContentfulPaint: number;
}

export interface ScrollMetrics {
  fps1000Rows: number;
  fps10000Rows: number;
  rowRenderTime: number;
}

export interface MemoryMetric {
  initial: number;
  afterQueries: number;
  peak: number;
  perSession: number;
}

/**
 * Performance metrics for a component
 */
export interface ComponentMetrics {
  componentName: string;
  mountTime: number;
  updateTime: number;
  renderCount: number;
  lastRenderTime: number;
}

/**
 * Timing metrics
 */
export interface TimingMetrics {
  dnsLookup: number;
  tcpConnection: number;
  tlsHandshake: number;
  timeToFirstByte: number;
  contentDownload: number;
  domInteractive: number;
  domComplete: number;
}

/**
 * Network performance metrics
 */
export interface NetworkMetrics {
  totalRequests: number;
  totalBytes: number;
  cachedRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  slowestRequest?: {
    url: string;
    duration: number;
  };
}

/**
 * FPS metrics for animation performance
 */
export interface FPSMetrics {
  current: number;
  average: number;
  minimum: number;
  maximum: number;
  droppedFrames: number;
  totalFrames: number;
}

/**
 * Bundle size metrics
 */
export interface BundleMetrics {
  totalSize: number;
  initialSize: number;
  lazySize: number;
  chunks: BundleChunk[];
}

/**
 * Bundle chunk information
 */
export interface BundleChunk {
  name: string;
  size: number;
  gzipSize: number;
  modules: number;
}

/**
 * Core web vitals metrics
 */
export interface CoreWebVitals {
  lcp: number;
  fid: number;
  cls: number;
  fcp: number;
  ttfb: number;
}

/**
 * Resource timing entry
 */
export interface ResourceTiming {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  transferSize: number;
  initiatorType: string;
}

/**
 * Performance observer entry
 */
export interface PerformanceObserverEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  processingStart?: number;
}

/**
 * Long task information
 */
export interface LongTask {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  attribution: LongTaskAttribution[];
}

/**
 * Long task attribution
 */
export interface LongTaskAttribution {
  containerType: string;
  containerName: string;
  containerId: string;
}

/**
 * Memory performance metrics
 */
export interface MemoryPerformance {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/**
 * Benchmark options
 */
export interface BenchmarkOptions {
  iterations: number;
  warmupIterations: number;
  delay: number;
  name?: string;
  setup?: () => void;
  teardown?: () => void;
}

/**
 * Benchmark report
 */
export interface BenchmarkReport {
  name: string;
  mean: number;
  median: number;
  standardDeviation: number;
  min: number;
  max: number;
  samples: number[];
  opsPerSecond: number;
}

/**
 * Performance mark
 */
export interface PerformanceMark {
  name: string;
  startTime: number;
  detail?: unknown;
}

/**
 * Performance measure
 */
export interface PerformanceMeasure {
  name: string;
  startTime: number;
  duration: number;
  detail?: unknown;
}

/**
 * Metric threshold configuration
 */
export interface MetricThreshold {
  name: string;
  warning: number;
  critical: number;
  unit: "ms" | "fps" | "bytes" | "percentage";
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  id: string;
  type: "warning" | "critical";
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  message: string;
}

/**
 * Performance report summary
 */
export interface PerformanceSummary {
  timestamp: number;
  url: string;
  metrics: {
    coreWebVitals: CoreWebVitals;
    timings: TimingMetrics;
    memory: MemoryPerformance;
    network: NetworkMetrics;
  };
  alerts: PerformanceAlert[];
}
