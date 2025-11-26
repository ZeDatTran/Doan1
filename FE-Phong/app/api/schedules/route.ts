import { NextResponse } from "next/server"

// Mock schedules data
const schedules = [
  {
    id: "schedule_1",
    name: "Weekday Evening Lights",
    targetId: "group_1",
    action: "on" as const,
    time: "18:00",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    enabled: true,
    createdAt: new Date().toISOString(),
  },
]

export async function GET() {
  return NextResponse.json(schedules)
}

export async function POST(request: Request) {
  const body = await request.json()

  const newSchedule = {
    id: `schedule_${Date.now()}`,
    ...body,
    createdAt: new Date().toISOString(),
  }

  schedules.push(newSchedule)
  return NextResponse.json(newSchedule, { status: 201 })
}
