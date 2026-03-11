"use client";

import { useState, useMemo, useCallback, memo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceArea,
} from "recharts";
import { Card } from "@/components/ui/card";
import { useTheme } from "next-themes";

interface HistogramData {
  time: string;
  count: number;
}

interface DiscoverHistogramProps {
  data: HistogramData[];
  isLoading?: boolean;
  onBarClick?: (startTime: string, endTime?: string) => void;
  activeTime?: string | null;
}

// Type for Recharts events
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartEvent = any;

export const DiscoverHistogram = memo(function DiscoverHistogram({
  data,
  isLoading,
  onBarClick,
}: DiscoverHistogramProps) {
  const { theme } = useTheme();
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const formattedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      timeObj: new Date(item.time),
    }));
  }, [data]);

  // Calculate interval between bars to determine range
  const intervalMs = useMemo(() => {
    if (data.length < 2) return 0;
    const t1 = new Date(data[0].time).getTime();
    const t2 = new Date(data[1].time).getTime();
    return Math.abs(t2 - t1);
  }, [data]);

  const adaptiveHeight = useMemo(() => {
    if (data.length === 0) return 150;

    const minHeight = 100;
    const maxHeight = 300;
    const heightPerPoint = 2;

    const calculatedHeight = Math.min(
      minHeight + data.length * heightPerPoint,
      maxHeight,
    );
    return calculatedHeight;
  }, [data.length]);

  const formatDate = useCallback(
    (time: string) => {
      try {
        const date = new Date(time);
        if (isNaN(date.getTime())) return time;

        const timeStr = date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

        if (data.length <= 1) {
          return `${dateStr} ${timeStr}`;
        }

        const start = new Date(data[0].time);
        const end = new Date(data[data.length - 1].time);

        if (
          start.getFullYear() !== end.getFullYear() ||
          start.getMonth() !== end.getMonth() ||
          start.getDate() !== end.getDate() ||
          end.getTime() - start.getTime() >= 24 * 60 * 60 * 1000
        ) {
          if (intervalMs >= 23 * 60 * 60 * 1000) {
            return dateStr;
          }
          return `${dateStr} ${timeStr}`;
        }

        return timeStr;
      } catch {
        return time;
      }
    },
    [data, intervalMs],
  );

  const handleBarClick = useCallback(
    (time: string) => {
      if (!onBarClick) return;

      if (intervalMs > 0) {
        const startTime = new Date(time);
        const endTime = new Date(startTime.getTime() + intervalMs);
        onBarClick(startTime.toISOString(), endTime.toISOString());
      } else {
        // Fallback for single bar or unknown interval
        const startTime = new Date(time);
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        onBarClick(startTime.toISOString(), endTime.toISOString());
      }
    },
    [onBarClick, intervalMs],
  );

  const handleMouseDown = useCallback((e: ChartEvent) => {
    if (e && e.activeLabel) {
      setRefAreaLeft(e.activeLabel);
      setIsDragging(true);
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: ChartEvent) => {
      if (isDragging && e && e.activeLabel) {
        setRefAreaRight(e.activeLabel);
      }
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);

    if (refAreaLeft && refAreaRight && onBarClick) {
      const leftTime = new Date(refAreaLeft).getTime();
      const rightTime = new Date(refAreaRight).getTime();

      let start = refAreaLeft;
      let end = refAreaRight;

      if (leftTime > rightTime) {
        start = refAreaRight;
        end = refAreaLeft;
      }

      if (start === end) {
        handleBarClick(start);
      } else {
        // Range selection via brush
        onBarClick(start, end);
      }
    } else if (refAreaLeft && !refAreaRight && onBarClick) {
      // Single click without drag
      handleBarClick(refAreaLeft);
    }

    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, onBarClick, handleBarClick]);

  if (isLoading && data.length === 0) {
    return (
      <Card
        className={`h-[${adaptiveHeight}px] w-full flex items-center justify-center bg-muted/20 animate-pulse border-none shadow-none`}
        style={{ height: `${adaptiveHeight}px` }}
      >
        <span className="text-muted-foreground text-sm">
          Loading histogram...
        </span>
      </Card>
    );
  }

  if (data.length === 0) {
    return null;
  }

  return (
    <div
      className="w-full transition-all duration-300 select-none"
      style={{ height: `${adaptiveHeight}px` }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={formattedData}
          margin={{
            top: 5,
            right: 10,
            left: 0,
            bottom: 0,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (isDragging) {
              setIsDragging(false);
              setRefAreaLeft(null);
              setRefAreaRight(null);
            }
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme === "dark" ? "#333" : "#eee"}
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tickFormatter={formatDate}
            stroke={theme === "dark" ? "#888" : "#666"}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis
            stroke={theme === "dark" ? "#888" : "#666"}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              new Intl.NumberFormat("en", { notation: "compact" }).format(value)
            }
            width={35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: theme === "dark" ? "#1f1f1f" : "#fff",
              borderColor: theme === "dark" ? "#333" : "#ddd",
              fontSize: "12px",
              borderRadius: "6px",
            }}
            labelFormatter={(label) => {
              const d = new Date(String(label));
              if (!isNaN(d.getTime())) {
                return d.toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                });
              }
              return String(label);
            }}
            cursor={{ fill: "transparent" }}
          />
          <Bar
            dataKey="count"
            fill={theme === "dark" ? "#60a5fa" : "#3b82f6"}
            radius={[2, 2, 0, 0]}
            maxBarSize={50}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            {formattedData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={theme === "dark" ? "#60a5fa" : "#3b82f6"}
              />
            ))}
          </Bar>

          {refAreaLeft && refAreaRight ? (
            <ReferenceArea
              x1={refAreaLeft}
              x2={refAreaRight}
              strokeOpacity={0.3}
              fill={theme === "dark" ? "#fff" : "#000"}
              fillOpacity={0.1}
            />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
