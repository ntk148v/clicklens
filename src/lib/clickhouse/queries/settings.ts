/**
 * ClickHouse Settings SQL Queries
 *
 * Centralized queries for session and server settings.
 */

// =============================================================================
// Session Settings
// =============================================================================

/** Get session settings, optionally filtered by name */
export const getSessionSettingsQuery = (safeSearch: string) => `
SELECT
  name,
  value,
  changed,
  description,
  type,
  min,
  max,
  readonly
FROM system.settings
WHERE name ILIKE '%${safeSearch}%'
ORDER BY name ASC
`;

// =============================================================================
// Server Settings
// =============================================================================

/** Get server settings, optionally filtered by name */
export const getServerSettingsQuery = (safeSearch: string) => `
SELECT
  name,
  value,
  default,
  changed,
  description,
  type,
  changeable_without_restart as is_hot_reloadable
FROM system.server_settings
WHERE name ILIKE '%${safeSearch}%'
ORDER BY name ASC
`;
