/**
 * ClickHouse Monitoring Types
 * Type definitions for cluster monitoring data structures
 */

// =============================================================================
// Overview Types
// =============================================================================

export interface ClusterOverview {
  uptime: number; // seconds
  version: string;
  activeQueries: number;
  connections: {
    tcp: number;
    http: number;
    total: number;
  };
  memory: {
    used: number; // bytes
    total: number; // bytes
    percentage: number;
  };
  readonlyReplicas: number;
  maxPartsPerPartition: number;
  backgroundPoolTasks: number;
}

// =============================================================================
// Metrics Types
// =============================================================================

export type MetricCategory =
  | "query"
  | "connection"
  | "memory"
  | "merge"
  | "replication"
  | "insert"
  | "io"
  | "other";

export interface SystemMetric {
  metric: string;
  value: number;
  description: string;
  category: MetricCategory;
}

export interface SystemAsyncMetric {
  metric: string;
  value: number;
  description: string;
}

export interface SystemEvent {
  event: string;
  value: number;
  description: string;
}

// Combined metrics response
export interface MetricsResponse {
  metrics: SystemMetric[];
  asyncMetrics: SystemAsyncMetric[];
  events: SystemEvent[];
}

// =============================================================================
// Replication Types
// =============================================================================

export interface ReplicaStatus {
  database: string;
  table: string;
  engine: string;
  isLeader: boolean;
  canBecomeLeader: boolean;
  isReadonly: boolean;
  isSessionExpired: boolean;
  futurePartsCount: number;
  partsToCheckCount: number;
  zookeeperPath: string;
  replicaName: string;
  replicaPath: string;
  columnsVersion: number;
  queueSize: number;
  insertsInQueue: number;
  mergesInQueue: number;
  partMutationsInQueue: number;
  queueOldestTime: string;
  insertsOldestTime: string;
  mergesOldestTime: string;
  logMaxIndex: number;
  logPointer: number;
  lastQueueUpdate: string;
  absoluteDelay: number;
  totalReplicas: number;
  activeReplicas: number;
}

export interface ReplicaSummary {
  totalTables: number;
  healthyTables: number;
  readonlyTables: number;
  tablesWithDelay: number;
  maxDelay: number;
}

// =============================================================================
// Operations Types (Merges & Mutations)
// =============================================================================

export interface MergeInfo {
  database: string;
  table: string;
  elapsed: number;
  progress: number;
  numParts: number;
  sourcePartNames: string[];
  resultPartName: string;
  sourcePartPaths: string[];
  resultPartPath: string;
  partitionId: string;
  isMutation: boolean;
  totalSizeBytesCompressed: number;
  bytesReadUncompressed: number;
  rowsRead: number;
  bytesWrittenUncompressed: number;
  rowsWritten: number;
  memoryUsage: number;
  threadId: number;
  mergeType: string;
  mergeAlgorithm: string;
}

export interface MutationInfo {
  database: string;
  table: string;
  mutationId: string;
  command: string;
  createTime: string;
  blockNumbers: Record<string, number>;
  partsToDo: number;
  isDone: boolean;
  latestFailedPart: string;
  latestFailTime: string;
  latestFailReason: string;
}

export interface OperationsResponse {
  merges: MergeInfo[];
  mutations: MutationInfo[];
  mergeSummary: {
    activeMerges: number;
    totalBytesProcessing: number;
    avgProgress: number;
  };
  mutationSummary: {
    activeMutations: number;
    failedMutations: number;
    totalPartsToDo: number;
  };
}

// =============================================================================
// Health Check Types
// =============================================================================

export type HealthStatus = "ok" | "warning" | "critical" | "unknown";

export interface HealthCheck {
  id: string;
  name: string;
  description: string;
  status: HealthStatus;
  value: number | string;
  threshold?: {
    warning?: number;
    critical?: number;
  };
  message: string;
  lastChecked: string;
}

export interface HealthSummary {
  overallStatus: HealthStatus;
  checks: HealthCheck[];
  okCount: number;
  warningCount: number;
  criticalCount: number;
}

// =============================================================================
// Time Series Types (for charts)
// =============================================================================

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface TimeSeriesData {
  metric: string;
  unit: string;
  data: TimeSeriesPoint[];
}

// =============================================================================
// API Response Types
// =============================================================================

export interface MonitoringApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

// =============================================================================
// Disk & Storage Types
// =============================================================================

export interface DiskInfo {
  name: string;
  path: string;
  freeSpace: number;
  totalSpace: number;
  usedSpace: number;
  usedPercentage: number;
  keepFreeSpace: number;
  type: string;
}

// =============================================================================
// Query Performance Types
// =============================================================================

export interface QueryPerformanceMetrics {
  queriesPerSecond: number;
  avgDurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  insertedRowsPerSecond: number;
  selectedRowsPerSecond: number;
  failedQueriesCount: number;
}

// =============================================================================
// Cluster Node Types
// =============================================================================

export interface ClusterNode {
  cluster: string;
  shardNum: number;
  replicaNum: number;
  hostName: string;
  hostAddress: string;
  port: number;
  isLocal: boolean;
  isActive: boolean;
  errorsCount: number;
  slowdownsCount: number;
  estimatedRecoveryTime: number;
}

export interface ClusterSummary {
  totalNodes: number;
  activeNodes: number;
  inactiveNodes: number;
  totalShards: number;
  maxReplicas: number;
  totalErrors: number;
  clusterCount: number;
}

export interface ClusterInfo {
  name: string;
  nodes: ClusterNode[];
  shards: number;
  replicas: number;
  activeNodes: number;
  totalNodes: number;
}

