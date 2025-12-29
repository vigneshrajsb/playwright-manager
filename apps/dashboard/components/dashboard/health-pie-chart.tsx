"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Cell, Pie, PieChart } from "recharts";

interface HealthPieChartProps {
  data: {
    healthy?: number;
    warning?: number;
    critical?: number;
  };
}

const chartConfig = {
  healthy: {
    label: "Healthy",
    color: "hsl(142.1 76.2% 36.3%)", // green-600
  },
  warning: {
    label: "Warning",
    color: "hsl(45.4 93.4% 47.5%)", // yellow-500
  },
  critical: {
    label: "Failing",
    color: "hsl(0 72.2% 50.6%)", // red-600
  },
} satisfies ChartConfig;

const COLORS = {
  healthy: "hsl(142.1 76.2% 36.3%)",
  warning: "hsl(45.4 93.4% 47.5%)",
  critical: "hsl(0 72.2% 50.6%)",
};

export function HealthPieChart({ data }: HealthPieChartProps) {
  const chartData = [
    { name: "healthy", value: data.healthy || 0, fill: COLORS.healthy },
    { name: "warning", value: data.warning || 0, fill: COLORS.warning },
    { name: "critical", value: data.critical || 0, fill: COLORS.critical },
  ].filter((item) => item.value > 0);

  const total = chartData.reduce((acc, item) => acc + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Test Health Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No health data available
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => [
                      `${value} tests`,
                      chartConfig[name as keyof typeof chartConfig]?.label ||
                        name,
                    ]}
                  />
                }
              />
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
