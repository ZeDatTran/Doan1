"use client"

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { Skeleton } from "@/components/ui/skeleton"

interface DeviceChartProps {
  data: Array<{
    timestamp: string
    power?: number
    voltage?: number
    current?: number
    energy?: number
  }>
  dataKey: "power" | "voltage" | "current" | "energy"
  color: string
  unit: string
  isLoading?: boolean
}

export function DeviceChart({ data, dataKey, color, unit, isLoading }: DeviceChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[350px] w-full" />
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[350px] flex items-center justify-center text-muted-foreground">
        <p>Chưa có dữ liệu lịch sử cho thiết bị này</p>
      </div>
    )
  }

  // Format data for chart
  const chartData = data.map((item) => ({
    ...item,
    time: new Date(item.timestamp).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    value: item[dataKey] || 0,
  }))

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <span className="text-muted-foreground">Thời gian:</span>
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground">Giá trị:</span>
                      <span className="font-medium" style={{ color }}>
                        {Number(payload[0].value).toFixed(2)} {unit}
                      </span>
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
