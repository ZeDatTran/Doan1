"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { EnergyData } from "@/lib/api"
import { formatEnergy, formatCurrency } from "@/lib/utils"

interface EnergyChartProps {
  data: EnergyData[]
  period: "day" | "week" | "month"
}

export function EnergyChart({ data, period }: EnergyChartProps) {
  const formatXAxis = (timestamp: string) => {
    const date = new Date(timestamp)
    if (period === "day") {
      return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    } else if (period === "week") {
      return date.toLocaleDateString("vi-VN", { weekday: "short" })
    } else {
      return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
    }
  }

  const chartData = data.map((item) => ({
    timestamp: formatXAxis(item.timestamp),
    consumption: item.consumption,
    cost: item.cost,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Biểu đồ tiêu thụ điện</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="timestamp" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="text-sm font-medium">{payload[0].payload.timestamp}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Tiêu thụ:{" "}
                        <span className="font-semibold text-foreground">
                          {formatEnergy(payload[0].value as number)}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Chi phí:{" "}
                        <span className="font-semibold text-foreground">{formatCurrency(payload[0].payload.cost)}</span>
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Area
              type="monotone"
              dataKey="consumption"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2}
              fill="url(#colorConsumption)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
