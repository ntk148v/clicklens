"use client";

import { MultiSeriesChart, MetricChart } from "@/components/monitoring";

interface TimeSeriesPoint {
  t: string;
  node: string;
  value: number;
}

interface ChartConfig {
  title: string;
  data: TimeSeriesPoint[];
  options?: { isBytes?: boolean; unit?: string };
}

interface MetricsGridProps {
  title: string;
  icon: React.ReactNode;
  charts: ChartConfig[];
  nodes: string[];
  isLoading: boolean;
}

// Transform per-node data for charts
function transformToChartData(data: TimeSeriesPoint[]) {
  return data.map((p) => ({
    timestamp: p.t,
    node: p.node,
    value: p.value,
  }));
}

// For single line charts (when only 1 node)
function transformToSingleSeries(data: TimeSeriesPoint[]) {
  return data.map((p) => ({
    timestamp: p.t,
    value: p.value,
  }));
}

export function MetricsGrid({ title, icon, charts, nodes, isLoading }: MetricsGridProps) {
  const isMultiNode = nodes.length > 1;

  const renderChart = (
    title: string,
    chartData: TimeSeriesPoint[],
    options: { isBytes?: boolean; unit?: string } = {},
  ) => {
    if (isMultiNode) {
      const transformedData = transformToChartData(chartData);
      return (
        <MultiSeriesChart
          key={title}
          title={title}
          data={transformedData}
          nodes={nodes}
          isBytes={options.isBytes}
          unit={options.unit}
          height={140}
          showAxis
          loading={isLoading}
        />
      );
    }

    return (
      <MetricChart
        key={title}
        title={title}
        data={transformToSingleSeries(chartData)}
        isBytes={options.isBytes}
        unit={options.unit}
        height={140}
        showAxis
        loading={isLoading}
      />
    );
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {charts.map((chart) =>
          renderChart(chart.title, chart.data, chart.options)
        )}
      </div>
    </section>
  );
}
