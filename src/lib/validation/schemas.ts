/**
 * Zod Validation Schemas
 *
 * Provides schema validation for API routes using Zod.
 * Centralized validation ensures consistent input handling across all endpoints.
 */

import { z } from "zod";

const MAX_SQL_LENGTH = 100000;
const MAX_QUERY_TIMEOUT_MS = 300000;
const MAX_ROWS = 500000;

export const QueryRequestSchema = z.object({
  sql: z
    .string()
    .min(1, "SQL query is required")
    .max(MAX_SQL_LENGTH, `SQL query must be less than ${MAX_SQL_LENGTH} characters`),
  database: z.string().optional(),
  timezone: z.string().optional(),
  timeout: z
    .number()
    .min(1)
    .max(MAX_QUERY_TIMEOUT_MS)
    .optional()
    .refine((val) => val === undefined || val > 0, {
      message: "Timeout must be a positive number",
    }),
  page: z.number().int().min(0).optional(),
  pageSize: z.number().int().min(1).max(10000).optional(),
  cache: z.boolean().optional(),
  query_id: z.string().optional(),
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;

export const DiscoverRequestSchema = z.object({
  database: z.string().min(1, "Database is required"),
  table: z.string().min(1, "Table is required"),
  timeRange: z
    .object({
      minTime: z.string().optional(),
      maxTime: z.string().optional(),
    })
    .optional(),
  filter: z.string().optional(),
  columns: z.array(z.string()).optional(),
  groupBy: z.string().optional(),
  orderBy: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_ROWS).optional(),
  offset: z.number().int().min(0).optional(),
  cursor: z.string().optional(),
  histogram: z.boolean().optional(),
  interval: z.string().optional(),
});

export type DiscoverRequest = z.infer<typeof DiscoverRequestSchema>;

export const FieldValuesRequestSchema = z.object({
  database: z.string().min(1),
  table: z.string().min(1),
  field: z.string().min(1),
  filter: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  timeRange: z
    .object({
      minTime: z.string().optional(),
      maxTime: z.string().optional(),
    })
    .optional(),
});

export type FieldValuesRequest = z.infer<typeof FieldValuesRequestSchema>;

export const LoginRequestSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const PasswordChangeRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export type PasswordChangeRequest = z.infer<typeof PasswordChangeRequestSchema>;

export const SavedQuerySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  query: z.string().min(1).max(MAX_SQL_LENGTH),
  database: z.string(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export type SavedQuery = z.infer<typeof SavedQuerySchema>;

export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export const KillQueryRequestSchema = z.object({
  query_id: z.string().min(1),
});

export type KillQueryRequest = z.infer<typeof KillQueryRequestSchema>;
