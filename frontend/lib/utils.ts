import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "Vừa xong"
  if (minutes < 60) return `${minutes} phút trước`
  if (hours < 24) return `${hours} giờ trước`
  if (days < 7) return `${days} ngày trước`

  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatEnergy(value: number): string {
  return `${value.toFixed(2)} kWh`
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value)
}

/**
 * Aggregate energy data by day for week/month views
 * Groups hourly data into daily totals
 */
export function aggregateEnergyDataByDay(data: Array<{ timestamp: string; consumption: number; cost: number }>) {
  const dailyMap = new Map<string, { consumption: number; cost: number; timestamp: string }>()

  data.forEach((item) => {
    // const date = new Date(item.timestamp)
    // Use YYYY-MM-DD as key for grouping
    const dayKey = item.timestamp.split('T')[0]

    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, {
        consumption: 0,
        cost: 0,
        timestamp: dayKey + 'T00:00:00'
      })
    }

    const entry = dailyMap.get(dayKey)!
    entry.consumption += item.consumption
    entry.cost += item.cost
  })

  // Convert map to array and sort by date
  return Array.from(dailyMap.values())
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(item => ({
      timestamp: item.timestamp,
      consumption: Math.round(item.consumption * 100) / 100,
      cost: Math.round(item.cost)
    }))
}
