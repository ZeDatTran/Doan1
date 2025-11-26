"use client"

import { DeviceTable } from "@/components/device-table"

export default function MonitorPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Device Monitor</h1>
        <p className="text-muted-foreground">Real-time device monitoring and management</p>
      </div>
      <DeviceTable />
    </div>
  )
}
