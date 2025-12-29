"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

interface PassRateChartProps {
  data: Array<{
    date: string;
    passRate: number;
    totalTests: number;
    totalRuns: number;
  }>;
}

const chartConfig = {
  passRate: {
    label: "Pass Rate",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function PassRateChart({ data }: PassRateChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Pass Rate Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <LineChart
              data={data}
              margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={40}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatDate(value as string)}
                    formatter={(value) => [`${value}%`, "Pass Rate"]}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="passRate"
                stroke="hsl(142.1 76.2% 36.3%)"
                strokeWidth={2}
                dot={{ fill: "hsl(142.1 76.2% 36.3%)", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
