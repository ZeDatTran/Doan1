import { NextResponse } from "next/server"

const deviceTree = [
  {
    id: "area_1",
    name: "Arena",
    type: "area",
    children: [
      {
        id: "group_1",
        name: "Main Lights",
        type: "group",
        children: [
          { id: "device_1", name: "Arena Light 1", type: "device" },
          { id: "device_2", name: "Arena Light 2", type: "device" },
        ],
      },
    ],
  },
  {
    id: "area_2",
    name: "Entrance",
    type: "area",
    children: [
      {
        id: "group_2",
        name: "Entrance Lights",
        type: "group",
        children: [{ id: "device_3", name: "Entrance Light", type: "device" }],
      },
    ],
  },
]

export async function GET() {
  return NextResponse.json(deviceTree)
}
