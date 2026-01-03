"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MetricChartProps {
  title: string;
  data: Array<{ timestamp: string; value: number }>;
  unit?: string;
  color?: string;
  height?: number;
  showAxis?: boolean;
  className?: string;
  loading?: boolean;
}

// Define chart colors that work well in both light and dark themes
const CHART_COLORS = {
  "hsl(var(--chart-1))": "#22c55e", // green-500
  "hsl(var(--chart-2))": "#3b82f6", // blue-500
  "hsl(var(--chart-3))": "#a855f7", // purple-500
  "hsl(var(--chart-4))": "#f59e0b", // amber-500
  "hsl(var(--chart-5))": "#ef4444", // red-500
  "hsl(var(--primary))": "#3b82f6", // blue-500
};

export function MetricChart({
  title,
  data,
  unit = "",
  color = "hsl(var(--chart-1))",
  height = 120,
  showAxis = false,
  className,
  loading = false,
}: MetricChartProps) {
  // Resolve the color - use a fallback for CSS variables
  const resolvedColor = CHART_COLORS[color as keyof typeof CHART_COLORS] || color;

  const formatValue = (value: number) => {
    if (value == null || !isFinite(value)) return "0";
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Generate a unique ID for this chart's gradient
  const gradientId = `gradient-${title.replace(/\s+/g, "-").toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {loading ? (
          <div
            className="animate-pulse bg-muted rounded"
            style={{ height: `${height}px` }}
          />
        ) : data.length === 0 ? (
          <div
            className="flex items-center justify-center text-muted-foreground text-sm"
            style={{ height: `${height}px` }}
          >
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart
              data={data}
              margin={{ top: 5, right: 5, left: showAxis ? 30 : 5, bottom: 5 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={resolvedColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={resolvedColor} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              {showAxis && (
                <>
                  <XAxis
                    dataKey="timestamp"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickFormatter={formatTime}
                    minTickGap={30}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickFormatter={formatValue}
                    width={35}
                  />
                </>
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#f9fafb",
                }}
                labelStyle={{ color: "#9ca3af" }}
                itemStyle={{ color: "#f9fafb" }}
                labelFormatter={formatTime}
                formatter={(value) => {
                  const numValue = typeof value === "number" ? value : 0;
                  return [`${formatValue(numValue)}${unit}`, title];
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={resolvedColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// Sparkline variant for inline display
export function Sparkline({
  data,
  color = "#3b82f6",
  width = 100,
  height = 30,
}: {
  data: Array<{ value: number }>;
  color?: string;
  width?: number;
  height?: number;
}) {
  const gradientId = `sparkline-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
