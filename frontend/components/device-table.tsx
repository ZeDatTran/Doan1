"use client"

import { useDevices, useUpdateDevice } from "@/hooks/use-devices"
import { useUIStore } from "@/lib/store"
import { Power } from "lucide-react"
import { useState } from "react"

export function DeviceTable() {
  const { data: devices, isLoading } = useDevices()
  const { mutate: updateDevice, isPending } = useUpdateDevice()
  const { selectedAreaId } = useUIStore()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const filteredDevices = devices?.filter((device) => !selectedAreaId || device.areaId === selectedAreaId) || []

  const handleTogglePower = (deviceId: string, isCurrentlyOn: boolean) => {
    setUpdatingId(deviceId)
    updateDevice(
      { id: deviceId, power: isCurrentlyOn ? 0 : 1 },
      {
        onSettled: () => setUpdatingId(null),
      }
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Device Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Area</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Power (W)</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Loading devices...
                </td>
              </tr>
            ) : filteredDevices.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No devices found
                </td>
              </tr>
            ) : (
              filteredDevices.map((device) => (
                <tr key={device.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{device.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{device.location}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        device.attributes?.POWER === "ON" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {device.attributes?.POWER === "ON" ? "online" : "offline"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{device.telemetry?.["ENERGY-Power"] || "N/A"}</td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => handleTogglePower(device.id, device.attributes?.POWER === "ON")}
                      disabled={updatingId === device.id || isPending}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                        device.attributes?.POWER === "ON"
                          ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <Power size={16} />
                      {device.attributes?.POWER === "ON" ? "On" : "Off"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
