# ClickLens

[![GitHub](https://img.shields.io/github/license/ntk148v/clicklens)](https://github.com/ntk148v/clicklens/blob/master/LICENSE)
[![Docker](https://img.shields.io/badge/docker-ghcr.io%2Fntk148v%2Fclicklens-blue)](https://ghcr.io/ntk148v/clicklens)

A modern, powerful web interface for managing and monitoring [ClickHouse](https://clickhouse.com/) databases.

## 1. Introduction

ClickLens provides a comprehensive suite of tools for developers, analysts, and administrators to interact with their ClickHouse clusters efficiently.

### 1.1. Why ClickLens?

ClickHouse is an incredible analytical database, but managing it via CLI or basic tools can be challenging. ClickLens bridges the gap by offering:

- **Discover** - Flexible, Kibana-like data exploration for any table
- **SQL Console** - Write, execute, and analyze queries with syntax highlighting and streaming results
- **Real-time Monitoring** - Keep an eye on your cluster's health, query performance, and resource usage
- **Schema Explorer** - Navigate databases, tables, columns, parts, and more
- **Access Control** - Manage users and roles directly from the UI
- **Native RBAC** - Your UI permissions are derived directly from your ClickHouse grants

## 2. Features

| Feature             | Description                                                                   |
| ------------------- | ----------------------------------------------------------------------------- |
| **Discover**        | Kibana-style exploration with time filtering, field selection, and histograms |
| **SQL Console**     | Multi-tab editor with autocomplete, EXPLAIN, saved queries, and streaming     |
| **Table Explorer**  | Browse schemas with parts, merges, mutations, and DDL views                   |
| **Monitoring**      | 8 dashboards for metrics, cluster, disks, Keeper, and replication             |
| **Query Analytics** | Running queries, history, performance analysis, and cache stats               |
| **Logging**         | Server logs, session logs, and crash logs                                     |
| **Access Control**  | User and role management with feature roles                                   |
| **Settings**        | View server and session settings                                              |

## 3. Documentation

Full documentation is available at **[https://ntk148v.github.io/clicklens](https://ntk148v.github.io/clicklens)**.

| Section                                                                | Description                          |
| ---------------------------------------------------------------------- | ------------------------------------ |
| [Getting Started](https://ntk148v.github.io/clicklens/getting-started) | Installation and first login         |
| [Features](https://ntk148v.github.io/clicklens/features)               | All features with usage instructions |
| [Architecture](https://ntk148v.github.io/clicklens/architecture)       | Tech stack, data flow, internals     |
| [Deployment](https://ntk148v.github.io/clicklens/deployment)           | Configuration, Docker, RBAC setup    |
| [Contributing](https://ntk148v.github.io/clicklens/contributing)       | Development setup, code guidelines   |

## 4. Screenshots

<!-- TODO: Add screenshots here -->

## 5. License

[MIT](LICENSE)
