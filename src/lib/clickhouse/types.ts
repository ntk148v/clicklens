/**
 * ClickHouse type definitions
 */

// Column metadata from ClickHouse response
export interface ColumnMeta {
  name: string;
  type: string;
}

// Query result structure
export interface QueryResult<T = Record<string, unknown>> {
  data: T[];
  rows: number;
  rows_before_limit_at_least?: number;
  meta: ColumnMeta[];
  statistics: QueryStatistics;
}

// Query execution statistics
export interface QueryStatistics {
  elapsed: number;
  rows_read: number;
  bytes_read: number;
}

// Error types for explicit handling
export type ClickHouseErrorType =
  | "permission_denied"
  | "timeout"
  | "syntax"
  | "not_found"
  | "oom"
  | "network"
  | "unknown";

// Structured error from ClickHouse
export interface ClickHouseError {
  code: number;
  message: string;
  type: ClickHouseErrorType;
}

// Query options
export interface QueryOptions {
  database?: string;
  format?: "JSON" | "JSONEachRow" | "TabSeparated" | "CSV";
  readonly?: boolean;
  max_execution_time?: number;
  max_rows_to_read?: number;
  max_bytes_to_read?: number;
}

// System table types
export interface SystemDatabase {
  name: string;
  engine: string;
  data_path: string;
  metadata_path: string;
  uuid: string;
}

export interface SystemTable {
  database: string;
  name: string;
  uuid: string;
  engine: string;
  is_temporary: boolean;
  data_paths: string[];
  metadata_path: string;
  metadata_modification_time: string;
  dependencies_database: string[];
  dependencies_table: string[];
  create_table_query: string;
  engine_full: string;
  partition_key: string;
  sorting_key: string;
  primary_key: string;
  sampling_key: string;
  storage_policy: string;
  total_rows: number | null;
  total_bytes: number | null;
  comment: string;
}

export interface SystemColumn {
  database: string;
  table: string;
  name: string;
  type: string;
  position: number;
  default_kind: string;
  default_expression: string;
  data_compressed_bytes: number;
  data_uncompressed_bytes: number;
  marks_bytes: number;
  comment: string;
  is_in_partition_key: boolean;
  is_in_sorting_key: boolean;
  is_in_primary_key: boolean;
  is_in_sampling_key: boolean;
}

export interface SystemPart {
  partition: string;
  name: string;
  uuid: string;
  part_type: string;
  active: boolean;
  marks: number;
  rows: number;
  bytes_on_disk: number;
  data_compressed_bytes: number;
  data_uncompressed_bytes: number;
  primary_key_bytes_in_memory: number;
  marks_bytes: number;
  modification_time: string;
  remove_time: string;
  refcount: number;
  min_date: string;
  max_date: string;
  min_time: string;
  max_time: string;
  partition_id: string;
  min_block_number: number;
  max_block_number: number;
  level: number;
  data_version: number;
  primary_key_bytes_in_memory_allocated: number;
  is_frozen: boolean;
  database: string;
  table: string;
  engine: string;
  disk_name: string;
  path: string;
}

export interface SystemProcess {
  is_initial_query: boolean;
  user: string;
  query_id: string;
  address: string;
  port: number;
  initial_user: string;
  initial_query_id: string;
  initial_address: string;
  initial_port: number;
  interface: number;
  os_user: string;
  client_hostname: string;
  client_name: string;
  client_revision: number;
  client_version_major: number;
  client_version_minor: number;
  client_version_patch: number;
  http_method: number;
  http_user_agent: string;
  http_referer: string;
  forwarded_for: string;
  quota_key: string;
  elapsed: number;
  is_cancelled: boolean;
  read_rows: number;
  read_bytes: number;
  total_rows_approx: number;
  written_rows: number;
  written_bytes: number;
  memory_usage: number;
  peak_memory_usage: number;
  query: string;
  thread_ids: number[];
  ProfileEvents: Record<string, number>;
  Settings: Record<string, string>;
}

export interface SystemQueryLog {
  type:
    | "QueryStart"
    | "QueryFinish"
    | "ExceptionBeforeStart"
    | "ExceptionWhileProcessing";
  event_date: string;
  event_time: string;
  event_time_microseconds: string;
  query_start_time: string;
  query_start_time_microseconds: string;
  query_duration_ms: number;
  read_rows: number;
  read_bytes: number;
  written_rows: number;
  written_bytes: number;
  result_rows: number;
  result_bytes: number;
  memory_usage: number;
  current_database: string;
  query: string;
  formatted_query: string;
  query_kind: string;
  databases: string[];
  tables: string[];
  columns: string[];
  exception_code: number;
  exception: string;
  stack_trace: string;
  is_initial_query: boolean;
  user: string;
  query_id: string;
  client_hostname: string;
  client_name: string;
  http_user_agent: string;
  thread_ids: number[];
  ProfileEvents: Record<string, number>;
  Settings: Record<string, string>;
}

export interface SystemMetric {
  metric: string;
  value: number;
  description: string;
}

export interface SystemEvent {
  event: string;
  value: number;
  description: string;
}

export interface SystemUser {
  name: string;
  id: string;
  storage: string;
  auth_type: string;
  auth_params: string;
  host_ip: string[];
  host_names: string[];
  host_names_regexp: string[];
  host_names_like: string[];
  default_roles_all: boolean;
  default_roles_list: string[];
  default_roles_except: string[];
  grantees_any: boolean;
  grantees_list: string[];
  grantees_except: string[];
  default_database: string;
}

export interface SystemRole {
  name: string;
  id: string;
  storage: string;
}

export interface SystemGrant {
  user_name: string | null;
  role_name: string | null;
  access_type: string;
  database: string | null;
  table: string | null;
  column: string | null;
  is_partial_revoke: boolean;
  grant_option: boolean;
}
