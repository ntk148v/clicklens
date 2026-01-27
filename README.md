<div align="center">
  <img src="./public/logo.png" width="20%" height="20%" />
  <h1>ClickLens</h1>
  <p>
    A modern, powerful web interface for managing and monitoring
    <a href="https://clickhouse.com">ClickHouse</a> databases.
  </p>
  <p>
    <a href="https://github.com/ntk148v/clicklens/blob/master/LICENSE">
      <img
        alt="License"
        src="https://img.shields.io/github/license/ntk148v/clicklens"
      />
    </a>
    <a href="https://ghcr.io/ntk148v/clicklens">
      <img
        alt="GitHub stars"
        src="https://img.shields.io/badge/docker-ghcr.io%2Fntk148v%2Fclicklens-blue"
      />
    </a>
  </p>
</div>

![](docs/public/screenshots/home-page.png)

<video src="https://github.com/user-attachments/assets/63685b9b-29f1-4fe1-b650-7f29bb7ff2be" controls></video>

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

### Discovery

|                               Overview                                |                              Filter                               |                                  Expandable Row                                   |
| :-------------------------------------------------------------------: | :---------------------------------------------------------------: | :-------------------------------------------------------------------------------: |
| ![discovery-overview](docs/public/screenshots/discovery-overview.png) | ![discovery-filter](docs/public/screenshots/discovery-filter.png) | ![discovery-expandable-row](docs/public/screenshots/discovery-expandable-row.png) |

### SQL Console

|                         Overview                          |                    Run Query                    |                            Results                            |
| :-------------------------------------------------------: | :---------------------------------------------: | :-----------------------------------------------------------: |
| ![sql-overview](docs/public/screenshots/sql-overview.png) | ![sql-run](docs/public/screenshots/sql-run.png) | ![sql-run-result](docs/public/screenshots/sql-run-result.png) |

|                         History                         |                                   Time Range                                    |                                 Table Preview                                 |
| :-----------------------------------------------------: | :-----------------------------------------------------------------------------: | :---------------------------------------------------------------------------: |
| ![sql-history](docs/public/screenshots/sql-history.png) | ![sql-time-range-selector](docs/public/screenshots/sql-time-range-selector.png) | ![sql-table-preview-data](docs/public/screenshots/sql-table-preview-data.png) |

### Monitoring

|                                Overview                                 |                                Metrics                                |                                   Async Metrics                                   |
| :---------------------------------------------------------------------: | :-------------------------------------------------------------------: | :-------------------------------------------------------------------------------: |
| ![monitoring-overview](docs/public/screenshots/monitoring-overview.png) | ![monitoring-metrics](docs/public/screenshots/monitoring-metrics.png) | ![monitoring-async-metrics](docs/public/screenshots/monitoring-async-metrics.png) |

|                              Disks                              |                                 ZooKeeper                                 |
| :-------------------------------------------------------------: | :-----------------------------------------------------------------------: |
| ![monitoring-disk](docs/public/screenshots/monitoring-disk.png) | ![monitoring-zookeeper](docs/public/screenshots/monitoring-zookeeper.png) |

### Queries

|                             History                             |                                History Filter                                 |                             Running                             |                              Analytics                              |
| :-------------------------------------------------------------: | :---------------------------------------------------------------------------: | :-------------------------------------------------------------: | :-----------------------------------------------------------------: |
| ![queries-history](docs/public/screenshots/queries-history.png) | ![queries-history-filter](docs/public/screenshots/queries-history-filter.png) | ![queries-running](docs/public/screenshots/queries-running.png) | ![queries-analytics](docs/public/screenshots/queries-analytics.png) |

### Access Control

|                                   Users                                   |                              Create User                              |                             Edit User                             |
| :-----------------------------------------------------------------------: | :-------------------------------------------------------------------: | :---------------------------------------------------------------: |
| ![access-user-overview](docs/public/screenshots/access-user-overview.png) | ![access-user-create](docs/public/screenshots/access-user-create.png) | ![access-user-edit](docs/public/screenshots/access-user-edit.png) |

|                                   Roles                                   |                              Create Role                              |                                   Feature Role                                    |
| :-----------------------------------------------------------------------: | :-------------------------------------------------------------------: | :-------------------------------------------------------------------------------: |
| ![access-role-overview](docs/public/screenshots/access-role-overview.png) | ![access-role-create](docs/public/screenshots/access-role-create.png) | ![access-role-feature-role](docs/public/screenshots/access-role-feature-role.png) |

### Settings

|                         Server Settings                         |                                       Server Expandable                                       |                         Session Settings                          |                                       Session Expandable                                        |
| :-------------------------------------------------------------: | :-------------------------------------------------------------------------------------------: | :---------------------------------------------------------------: | :---------------------------------------------------------------------------------------------: |
| ![settings-server](docs/public/screenshots/settings-server.png) | ![settings-server-expandable-row](docs/public/screenshots/settings-server-expandable-row.png) | ![settings-session](docs/public/screenshots/settings-session.png) | ![settings-session-expandable-row](docs/public/screenshots/settings-session-expandable-row.png) |

### Tables

|                            Columns                            |                           Parts                           |
| :-----------------------------------------------------------: | :-------------------------------------------------------: |
| ![tables-columns](docs/public/screenshots/tables-columns.png) | ![tables-parts](docs/public/screenshots/tables-parts.png) |

### Logging

|                          Server Logs                          |                         Crash Logs                          |
| :-----------------------------------------------------------: | :---------------------------------------------------------: |
| ![logging-server](docs/public/screenshots/logging-server.png) | ![logging-crash](docs/public/screenshots/logging-crash.png) |

### Profile

|                  User Profile                   |
| :---------------------------------------------: |
| ![profile](docs/public/screenshots/profile.png) |

## 5. License

[MIT](LICENSE)
