import { NextResponse } from "next/server"

// Mock device data
const devices = [
  {
    id: "device_1",
    name: "Arena Light 1",
    areaId: "area_1",
    groupId: "group_1",
    power: 1500,
    status: "online" as const,
    lastUpdate: new Date().toISOString(),
  },
  {
    id: "device_2",
    name: "Arena Light 2",
    areaId: "area_1",
    groupId: "group_1",
    power: 0,
    status: "online" as const,
    lastUpdate: new Date().toISOString(),
  },
  {
    id: "device_3",
    name: "Entrance Light",
    areaId: "area_2",
    groupId: "group_2",
    power: 800,
    status: "online" as const,
    lastUpdate: new Date().toISOString(),
  },
]

export async function GET() {
  return NextResponse.json(devices)
}
