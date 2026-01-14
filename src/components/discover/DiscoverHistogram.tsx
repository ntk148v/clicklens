"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
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
  onBarClick?: (time: string) => void;
  activeTime?: string | null;
}

export function DiscoverHistogram({
  data,
  isLoading,
  onBarClick,
}: DiscoverHistogramProps) {
  const { theme } = useTheme();

  const formattedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      // Ensure date object for formatting if needed, but string is fine for XAxis usually
      timeObj: new Date(item.time),
    }));
  }, [data]);

  const formatDate = (time: string) => {
    try {
      // Try to extract HH:mm from ISO string (2026-01-14T14:26:00Z or 2026-01-14 14:26:00)
      const datePart = time.split("T")[1] || time.split(" ")[1];
      if (datePart) {
        return datePart.substring(0, 5); // HH:mm
      }
      // Fallback if parsing fails
      return time.substring(11, 16);
    } catch {
      return time;
    }
  };

  if (isLoading && data.length === 0) {
    return (
      <Card className="h-[150px] w-full flex items-center justify-center bg-muted/20 animate-pulse border-none shadow-none">
        <span className="text-muted-foreground text-sm">
          Loading histogram...
        </span>
      </Card>
    );
  }

  if (data.length === 0) {
    return null; // Or show empty state
  }

  return (
    <div className="w-full h-[150px] transition-all duration-300">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={formattedData}
          margin={{
            top: 5,
            right: 10,
            left: 0,
            bottom: 0,
          }}
          onClick={(data) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload = data as any;
            if (
              payload &&
              payload.activePayload &&
              payload.activePayload.length > 0
            ) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onBarClick?.((payload.activePayload[0].payload as any).time);
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
            labelFormatter={(label) => String(label)}
            cursor={{ fill: "transparent" }}
          />
          <Bar
            dataKey="count"
            fill="#3b82f6"
            radius={[2, 2, 0, 0]}
            maxBarSize={50}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            {formattedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={theme === "dark" ? "#60a5fa" : "#3b82f6"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
