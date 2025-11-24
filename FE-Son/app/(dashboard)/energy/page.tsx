"use client"

import { useEffect, useState } from "react"
import { EnergyChart } from "@/components/energy/energy-chart"
import { EnergyStats } from "@/components/energy/energy-stats"
import { ThresholdAlert } from "@/components/energy/threshold-alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchEnergyData, type EnergyData } from "@/lib/api"

export default function EnergyPage() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day")
  const [data, setData] = useState<EnergyData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [period])

  const loadData = async () => {
    setLoading(true)
    const energyData = await fetchEnergyData(period)
    setData(energyData)
    setLoading(false)
  }

  const totalConsumption = data.reduce((sum, item) => sum + item.consumption, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Giám sát điện năng</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Theo dõi tiêu thụ điện và chi phí</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as "day" | "week" | "month")}>
          <TabsList>
            <TabsTrigger value="day">Ngày</TabsTrigger>
            <TabsTrigger value="week">Tuần</TabsTrigger>
            <TabsTrigger value="month">Tháng</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats */}
      <EnergyStats data={data} period={period} />

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart - takes 2 columns */}
        <div className="lg:col-span-2">
          <EnergyChart data={data} period={period} />
        </div>

        {/* Threshold alert - takes 1 column */}
        <div>
          <ThresholdAlert currentConsumption={totalConsumption} />
        </div>
      </div>
    </div>
  )
}
