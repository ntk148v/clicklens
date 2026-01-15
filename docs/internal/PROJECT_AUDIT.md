# ClickLens Technical Audit

> **Audit Date:** 2026-01-15  
> **Purpose:** Deep-dive technical analysis of the ClickLens project to bridge the gap between source code and documentation.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Feature Mapping (User Perspective)](#feature-mapping-user-perspective)
3. [Architecture Analysis (Developer Perspective)](#architecture-analysis-developer-perspective)
4. [Configuration Scan (Operator Perspective)](#configuration-scan-operator-perspective)
5. [Dependency Summary](#dependency-summary)
6. [Key Implementation Details](#key-implementation-details)

---

## Project Overview

| Property | Value |
|----------|-------|
| **Name** | ClickLens |
| **Version** | 0.0.1 |
| **Framework** | Next.js 16.1.1 (App Router) |
| **Runtime** | Bun (primary), Node.js 20 (production) |
| **UI Library** | React 19.2.3 |
| **Styling** | Tailwind CSS 4 |
| **ClickHouse Client** | @clickhouse/client 1.15.0 |
| **State Management** | Zustand 5.0.9 |
| **Authentication** | iron-session 8.0.4 |
| **Package Manager** | Bun |

### Project Structure
```
clicklens/
├── src/
│   ├── app/           # Next.js App Router (74 files)
│   │   ├── (app)/     # Authenticated routes
│   │   ├── api/       # API routes (41 files)
│   │   └── login/     # Public login page
│   ├── components/    # Reusable UI components (88 files)
│   └── lib/           # Core libraries (31 files)
├── docs/              # Documentation (Nextra)
├── e2e/               # Playwright E2E tests
└── public/            # Static assets
```

---

## Feature Mapping (User Perspective)

### High-Level Feature Modules

| # | Module | Route | Description | Permission Required |
|---|--------|-------|-------------|---------------------|
| 1 | **Dashboard** | `/` | Landing page with feature cards | Any authenticated user |
| 2 | **Discover** 🆕 | `/discover` | Kibana-like data exploration | `canDiscover` |
| 3 | **SQL Console** | `/sql` | Query editor with multi-tab support | `canExecuteQueries` |
| 4 | **Table Explorer** | `/tables` | Database/table browser | `canBrowseTables` |
| 5 | **Monitoring** | `/monitoring/*` | Cluster and query monitoring | `canViewCluster` |
| 6 | **Queries** | `/queries/*` | Query performance analytics | `canViewProcesses` |
| 7 | **Logging** | `/logging/*` | System/server/session logs | `canViewCluster` |
| 8 | **Access Control** | `/access/*` | User and role management | `canManageUsers` |
| 9 | **Settings** | `/settings/*` | Server settings viewer | `canViewSettings` |

---

### 1. Dashboard (`/`)
**File:** `src/app/(app)/page.tsx`

- Welcome hero section
- Dynamic feature cards (filtered by permissions)
- Getting started information block

---

### 2. Discover Feature 🆕 (Kibana-like Experience)

**Route:** `/discover`  
**Page:** `src/app/(app)/discover/page.tsx` (602 lines)  
**Permission:** `canDiscover`

The Discover feature is a flexible data exploration tool for any ClickHouse table.

#### Components

| Component | File | Description |
|-----------|------|-------------|
| **QueryBar** | `src/components/discover/QueryBar.tsx` | WHERE clause input with syntax help, query history (localStorage) |
| **FieldsSidebar** | `src/components/discover/FieldsSidebar.tsx` | Column selector for SELECT clause, time column picker |
| **DiscoverGrid** | `src/components/discover/DiscoverGrid.tsx` | Results table with TanStack Table, row detail sheet |
| **DiscoverHistogram** | `src/components/discover/DiscoverHistogram.tsx` | Time-series histogram using Recharts |

#### Key Features
- **Database/Table Selection** - Dynamic dropdowns for source selection
- **Field Selection** - Column picker affects SELECT clause
- **Time Column Selection** - Detected DateTime/Date columns for filtering
- **Time Range Picker** - Presets: 5m, 15m, 30m, 1h, 3h, 6h, 12h, 24h, 3d, 7d
- **Custom Filter** - Enter raw ClickHouse WHERE expressions
- **Histogram** - Click bars to zoom into time range
- **Load More** - Offset-based pagination for large result sets

#### Types (Defined in `src/lib/types/discover.ts`)
- `ColumnMetadata` - Name, type, nullable, default, comment
- `TimeColumnCandidate` - Detected time columns with primary flag
- `TableSchema` - Full table schema with time column detection
- `DiscoverRow` - Generic `Record<string, unknown>`
- `TimeRange` - Union type for time presets

#### API Endpoint
- **GET** `/api/clickhouse/discover`
  - Query params: `database`, `table`, `mode` (data/histogram), `columns`, `timeColumn`, `minTime`, `filter`, `limit`, `offset`

---

### 3. SQL Console (`/sql`)

**Route:** `/sql`  
**Page:** `src/app/(app)/sql/page.tsx` (1198 lines)  
**Permission:** `canExecuteQueries`

Full-featured SQL editor with multi-statement execution and real-time streaming.

#### Components

| Component | File | Description |
|-----------|------|-------------|
| **SqlEditor** | `src/components/sql/SqlEditor.tsx` | CodeMirror 6 editor with ClickHouse dialect |
| **ResultGrid** | `src/components/sql/ResultGrid.tsx` | TanStack Table with column resizing |
| **QueryTabs** | `src/components/sql/QueryTabs.tsx` | Tab management |
| **QueryHistory** | `src/components/sql/QueryHistory.tsx` | Local history viewer |
| **DatabaseSelector** | `src/components/sql/DatabaseSelector.tsx` | Database context selector |
| **TableSidebar** | `src/components/sql/TableSidebar.tsx` | Schema browser |
| **TablePreview** | `src/components/sql/TablePreview.tsx` | Quick data/structure preview |
| **SavedQueries** | `src/components/sql/SavedQueries.tsx` | Saved queries panel |
| **SaveQueryDialog** | `src/components/sql/SaveQueryDialog.tsx` | Save query modal |
| **ExplainButton** | `src/components/sql/ExplainButton.tsx` | EXPLAIN type selector |
| **ExplainVisualizer** | `src/components/sql/ExplainVisualizer.tsx` | EXPLAIN output viewer |
| **TimeRangeSelector** | `src/components/sql/TimeRangeSelector.tsx` | Quick date/time filter insertion |

#### Key Features
- **Multi-tab** - Persisted via Zustand + localStorage
- **Multi-statement** - Splits SQL by `;` and executes sequentially
- **Execute at Cursor** - Ctrl+Shift+Enter to run statement under cursor
- **Streaming Results** - NDJSON streaming for large result sets
- **Query Cancellation** - Backend KILL QUERY support
- **Autocomplete** - Tables, columns, functions, keywords
- **EXPLAIN** - AST, SYNTAX, PLAN, PIPELINE variants
- **Query History** - Tracks duration, rows, bytes, memory, user
- **Saved Queries** - CRUD via API

---

### 4. Table Explorer (`/tables`)

**Route:** `/tables`  
**Page:** `src/app/(app)/tables/page.tsx`  
**Permission:** `canBrowseTables`

Browse and inspect all databases, tables, and parts.

#### Table Detail Tabs

| Tab | Component | Description |
|-----|-----------|-------------|
| Overview | `overview-tab.tsx` | Summary stats |
| Columns | `columns-tab.tsx` | Column definitions |
| Parts | `parts-tab.tsx` | Data parts |
| Merges | `merges-tab.tsx` | Active merges |
| Mutations | `mutations-tab.tsx` | Pending mutations |
| Replicas | `replicas-tab.tsx` | Replica status |
| DDL | `ddl-tab.tsx` | CREATE TABLE statement |

---

### 5. Monitoring (`/monitoring/*`)

**Base Route:** `/monitoring`  
**Permission:** `canViewCluster`

Cluster health and performance monitoring.

#### Sub-Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/monitoring/overview` | `overview-tab.tsx` | Dashboard with key metrics |
| `/monitoring/metrics` | `metrics-tab.tsx` | system.metrics browser |
| `/monitoring/cluster` | `cluster-tab.tsx` | Cluster topology |
| `/monitoring/health` | `health-tab.tsx` | Health checks |
| `/monitoring/disks` | `disks-tab.tsx` | Disk usage |
| `/monitoring/keeper` | `keeper-tab.tsx` | ClickHouse Keeper status |
| `/monitoring/operations` | `operations-tab.tsx` | Merges and mutations |
| `/monitoring/replication` | `replication-tab.tsx` | Replication queue |

---

### 6. Queries (`/queries/*`)

**Permission:** `canViewProcesses`

Query performance and history.

| Route | Component | Description |
|-------|-----------|-------------|
| `/queries/running` | `running-tab.tsx` | Active queries (system.processes) |
| `/queries/history` | `history-tab.tsx` | Query log (system.query_log) |
| `/queries/analytics` | `analytics-tab.tsx` | Top queries analysis |
| `/queries/cache` | `cache-tab.tsx` | Query cache stats |

---

### 7. Logging (`/logging/*`)

**Permission:** `canViewCluster` (varies by sub-feature)

| Route | Component | Specific Permission |
|-------|-----------|---------------------|
| `/logging/server` | `LogsViewer.tsx` | `canViewServerLogs` |
| `/logging/session` | `SessionLogsTable.tsx` | `canViewSessionLogs` |
| `/logging/crash` | (system log view) | `canViewCrashLogs` |

---

### 8. Access Control (`/access/*`)

**Permission:** `canManageUsers`

| Route | Description |
|-------|-------------|
| `/access/users` | User list and management |
| `/access/roles` | Role list and grants |

---

### 9. Settings (`/settings/*`)

**Permission:** `canViewSettings`

| Route | Description |
|-------|-------------|
| `/settings/server` | Server settings (system.server_settings) |
| `/settings/session` | Session settings (system.settings) |

---

## Architecture Analysis (Developer Perspective)

### Directory Structure

```
src/lib/
├── auth/                # Session management
│   ├── index.ts         # Server-side session utilities
│   └── session.ts       # iron-session configuration
├── clickhouse/          # ClickHouse connectivity
│   ├── client.ts        # Client factory
│   ├── clients/         # HTTP and native clients
│   ├── config.ts        # Environment config
│   ├── types.ts         # TypeScript interfaces
│   ├── cluster.ts       # Cluster info
│   ├── metadata.ts      # Schema introspection
│   ├── monitoring/      # Monitoring queries
│   ├── index.ts         # Exports
│   └── utils.ts         # Formatting utilities
├── rbac/                # Role-based access control
│   ├── feature_roles.ts # Feature role definitions
│   └── index.ts         # Exports
├── store/               # Zustand stores
│   ├── sql-browser.ts   # Database/table browser state
│   ├── tabs.ts          # Query tabs + history
│   └── access.ts        # Access control state
├── hooks/               # Custom React hooks
│   ├── use-incremental-data.ts
│   ├── use-logs.ts
│   ├── use-monitoring.ts
│   ├── use-query-analytics.ts
│   ├── use-settings.ts
│   └── use-table-explorer.ts
├── types/               # Type definitions
│   └── discover.ts      # Discover feature types
├── sql/                 # SQL utilities
├── sql-context.ts       # SQL parsing context
├── clickhouse-functions.ts # Function autocomplete data
└── utils.ts             # General utilities
```

---

### State Management (Zustand)

| Store | File | Purpose | Persistence |
|-------|------|---------|-------------|
| **useSqlBrowserStore** | `sql-browser.ts` | Databases, tables, columns cache | None |
| **useTabsStore** | `tabs.ts` | Query tabs, history | localStorage |
| **useAccessStore** | `access.ts` | Access control UI state | None |

#### Tab Store Features
- Persists query tabs (SQL only, not results)
- History entries: `{ sql, timestamp, duration, rowsRead, bytesRead, memoryUsage, user, error }`
- Maximum 100 history entries

---

### Authentication & Authorization

#### Session Management
- **Library:** `iron-session` 8.0.4
- **Cookie Name:** `clicklens-session`
- **Session TTL:** 7 days
- **Session Data:**
  ```typescript
  interface SessionData {
    isLoggedIn: boolean;
    user?: {
      username: string;
      password: string;
      host?: string;
      database?: string;
    };
  }
  ```

#### Permission System

Permissions are derived from ClickHouse user grants at login time.

| Permission | Description | Derived From |
|------------|-------------|--------------|
| `canManageUsers` | Manage users/roles | ACCESS MANAGEMENT grant |
| `canViewProcesses` | View running queries | SELECT on system.processes |
| `canKillQueries` | Kill queries | KILL QUERY grant |
| `canViewCluster` | View cluster info | SELECT on system.clusters |
| `canBrowseTables` | Browse tables | SHOW TABLES grant |
| `canExecuteQueries` | Execute SQL | SELECT on any database |
| `canDiscover` | Use Discover feature | SHOW TABLES AND SELECT on any table |
| `canViewSettings` | View settings | SELECT on system.settings |
| `canViewSystemLogs` | View system logs | SELECT on system.text_log |
| `canViewServerLogs` | View server logs | SELECT on system.text_log |
| `canViewCrashLogs` | View crash logs | SELECT on system.crash_log |
| `canViewSessionLogs` | View session logs | SELECT on system.session_log |

---

### RBAC Feature Roles

Feature roles are ClickHouse roles prefixed with `clicklens_`. Defined in `src/lib/rbac/feature_roles.ts`:

| Role ID | Display Name | Purpose |
|---------|--------------|---------|
| `clicklens_table_explorer` | Table Explorer | Browse databases, tables, parts |
| `clicklens_query_monitor` | Query Monitor | View/kill queries, analyze performance |
| `clicklens_cluster_monitor` | Cluster Monitor | View cluster health and metrics |
| `clicklens_user_admin` | User Administration | Full access management |
| `clicklens_table_admin` | Table Administration | DDL operations |
| `clicklens_settings_admin` | Settings Viewer | View configuration |

---

### API Routes

#### Authentication (`/api/auth/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Authenticate user against ClickHouse |
| `/api/auth/logout` | POST | Clear session |
| `/api/auth/session` | GET | Get current session |
| `/api/auth/permissions` | GET | Get derived permissions |
| `/api/auth/password` | POST | Change password |

#### ClickHouse (`/api/clickhouse/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clickhouse/ping` | GET | Health check |
| `/api/clickhouse/databases` | GET | List databases |
| `/api/clickhouse/tables` | GET | List tables |
| `/api/clickhouse/tables/[table]` | GET | Table details |
| `/api/clickhouse/query` | POST | Execute query (streaming) |
| `/api/clickhouse/kill` | POST | Kill running query |
| `/api/clickhouse/discover` | GET | Discover feature queries |
| `/api/clickhouse/schema/*` | GET | Schema introspection |
| `/api/clickhouse/settings` | GET | Settings queries |
| `/api/clickhouse/logging` | GET | Log queries |
| `/api/clickhouse/queries/*` | GET | Query analytics |
| `/api/clickhouse/access/*` | GET/POST | Access control |
| `/api/clickhouse/monitoring/*` | GET | Monitoring data |

#### Saved Queries (`/api/saved-queries/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/saved-queries` | GET, POST | List/create saved queries |

---

### ClickHouse Client

Uses `@clickhouse/client` HTTP interface:

```typescript
interface ClickHouseConfig {
  host: string;
  port: number;
  secure: boolean;      // HTTPS
  verifySsl: boolean;   // Certificate verification
  username: string;
  password: string;
  database: string;
  settings?: Record<string, unknown>;
}
```

**Two Client Modes:**
1. **Lens Client** - Service account for metadata (env credentials)
2. **User Client** - End-user session credentials for queries

---

### Custom Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useIncrementalData` | `use-incremental-data.ts` | Polling with incremental updates |
| `useLogs` | `use-logs.ts` | Log fetching and filtering |
| `useMonitoring` | `use-monitoring.ts` | Monitoring data with auto-refresh |
| `useQueryAnalytics` | `use-query-analytics.ts` | Query performance analysis |
| `useSettings` | `use-settings.ts` | Settings management |
| `useTableExplorer` | `use-table-explorer.ts` | Table browsing state |

---

## Configuration Scan (Operator Perspective)

### Environment Variables

All environment variables found in the codebase:

| Variable | Required | Default | Source | Description |
|----------|----------|---------|--------|-------------|
| `CLICKHOUSE_HOST` | ✅ Yes | - | `config.ts` | ClickHouse server hostname |
| `CLICKHOUSE_PORT` | No | `8123`/`8443` | `config.ts` | HTTP port (auto-detects based on SECURE) |
| `CLICKHOUSE_SECURE` | No | `false` | `config.ts` | Use HTTPS (`true`/`false`) |
| `CLICKHOUSE_VERIFY` | No | `true` | `config.ts` | Verify SSL certificate |
| `LENS_USER` | ✅ Yes | - | `config.ts` | Service user for metadata queries |
| `LENS_PASSWORD` | No | `""` | `config.ts` | Service user password |
| `SESSION_SECRET` | Yes (prod) | Fallback string | `session.ts` | iron-session encryption key (≥32 chars) |
| `NODE_ENV` | No | `development` | `session.ts` | Environment mode |
| `DISABLE_SECURE_COOKIES` | No | `false` | `session.ts` | Allow insecure cookies in production |
| `NEXT_PUBLIC_APP_VERSION` | No | `package.json` | `next.config.ts` | App version for UI display |

### Sample Environment File (`env.sample`)
```bash
# ClickHouse Server Connection (required)
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_SECURE=false
CLICKHOUSE_VERIFY=true

# Lens Service User (for metadata queries)
LENS_USER=lensuser
LENS_PASSWORD=

# Session Secret (required for production)
SESSION_SECRET=complex_password_at_least_32_characters_long_for_security
```

---

### Docker Configuration

#### Dockerfile
- **Build Stage:** `oven/bun:latest` (deps + build)
- **Runtime Stage:** `node:20-alpine` (production)
- **Output:** Next.js standalone build
- **Exposed Port:** 3000

Build Args:
- `APP_VERSION` - Sets `NEXT_PUBLIC_APP_VERSION`

#### docker-compose.yml
```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - ./.env.local:/app/.env.local
    environment:
      - NODE_ENV=production
      - DISABLE_SECURE_COOKIES=true
    restart: unless-stopped
```

---

### Next.js Configuration

**File:** `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION:
      process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version,
  },
};
```

---

## Dependency Summary

### Production Dependencies

| Category | Libraries |
|----------|-----------|
| **Framework** | next 16.1.1, react 19.2.3, react-dom 19.2.3 |
| **ClickHouse** | @clickhouse/client 1.15.0 |
| **Editor** | @codemirror/* (autocomplete, commands, lang-sql, language, state, view) |
| **UI Components** | @radix-ui/* (12 packages), lucide-react, cmdk |
| **Forms** | react-hook-form, @hookform/resolvers, zod |
| **Auth** | iron-session 8.0.4 |
| **State** | zustand 5.0.9 |
| **Tables** | @tanstack/react-table 8.21.3 |
| **Charts** | recharts 3.6.0 |
| **Styling** | clsx, class-variance-authority, tailwind-merge |
| **Theming** | next-themes |

### Dev Dependencies

| Category | Libraries |
|----------|-----------|
| **Testing** | @playwright/test 1.57.0 |
| **Styling** | tailwindcss 4, @tailwindcss/postcss 4, tw-animate-css |
| **Linting** | eslint 9, eslint-config-next |
| **Types** | @types/node, @types/react, @types/react-dom |
| **Build** | typescript 5 |

---

## Key Implementation Details

### SQL Editor (CodeMirror 6)

**File:** `src/components/sql/SqlEditor.tsx` (996 lines)

Features:
- Custom ClickHouse SQL dialect with keywords and builtins
- Light/dark theme switching
- Context-aware autocomplete:
  - Keywords after `FROM`, `JOIN` → table suggestions
  - After `USE`, `DATABASE` → database suggestions
  - After table reference → column suggestions (async fetch)
- Function completions from `clickhouse-functions.ts` (15KB)
- Key bindings: Ctrl+Enter (execute), Ctrl+Shift+Enter (execute at cursor)

### Query Streaming

Query execution uses NDJSON streaming:
1. POST to `/api/clickhouse/query`
2. Server streams events: `meta`, `data`, `progress`, `done`, `error`
3. Client parses line-by-line, throttles UI updates (200ms)
4. Supports cancellation via `/api/clickhouse/kill`

### UI Component Library

Built on shadcn/ui patterns with Radix primitives:
- 30 UI components in `src/components/ui/`
- Uses `class-variance-authority` for variants
- Custom components: `TruncatedCell`, `JsonViewer`, `RecordDetailSheet`, `AccessDenied`

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Source Files | ~193 |
| App Routes | ~29 |
| API Endpoints | ~41 |
| UI Components | ~88 |
| Lib Modules | ~31 |
| Environment Variables | 10 |
| Feature Roles | 6 |
| Permission Types | 12 |

---

*This audit was generated by analyzing the ClickLens source code as of 2026-01-15.*
