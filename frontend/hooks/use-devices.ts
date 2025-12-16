import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchDevices, controlDevice, fetchDeviceById, fetchDeviceHistory } from "@/lib/api-client"
import type { Device as BackendDevice } from "@/lib/api-client"

// Extended device interface with UI-specific fields
export interface Device extends BackendDevice {
  name?: string
  areaId?: string
  groupId?: string
  status?: "online" | "offline"
  power?: number
  lastUpdate?: string
}

export interface DeviceHistoryPoint {
  timestamp: string
  power: number
  voltage: number
  current: number
  energy: number
}

export function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      const backendDevices = await fetchDevices()
      // Map backend data to Device interface
      return backendDevices.map((device, index) => ({
        id: device.id,
        type: device.type,
        location: device.location,
        attributes: device.attributes,
        telemetry: device.telemetry,
        // Add UI-specific fields
        name: device.type && device.location 
          ? `${device.type.charAt(0).toUpperCase() + device.type.slice(1)} - ${device.location}`
          : device.type || `Device ${index + 1}`,
        areaId: device.location,
        groupId: "",
        status: device.attributes?.POWER === "ON" ? "online" : "offline",
        power: device.attributes?.POWER === "ON" ? 1 : 0,
        lastUpdate: new Date().toISOString(),
      } as Device))
    },
  })
}

export function useDevice(deviceId: string) {
  return useQuery({
    queryKey: ["device", deviceId],
    queryFn: async () => {
      const device = await fetchDeviceById(deviceId)
      if (!device) return null
      return {
        ...device,
        name: device.type && device.location 
          ? `${device.type.charAt(0).toUpperCase() + device.type.slice(1)} - ${device.location}`
          : device.type || "Thiết bị",
        status: device.attributes?.POWER === "ON" ? "online" : "offline",
        power: device.attributes?.POWER === "ON" ? 1 : 0,
        lastUpdate: new Date().toISOString(),
      } as Device
    },
    enabled: !!deviceId,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  })
}

export function useDeviceHistory(deviceId: string, period: string = "day") {
  return useQuery({
    queryKey: ["device", deviceId, "history", period],
    queryFn: async () => {
      return fetchDeviceHistory(deviceId, period)
    },
    enabled: !!deviceId,
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

export function useDeviceTree() {
  return useQuery({
    queryKey: ["devices", "tree"],
    queryFn: async () => {
      const devices = await fetchDevices()
      // Group devices by location for tree structure
      const grouped = devices.reduce(
        (acc, device) => {
          const location = device.location || "Unknown"
          if (!acc[location]) {
            acc[location] = []
          }
          acc[location].push(device)
          return acc
        },
        {} as Record<string, BackendDevice[]>
      )

      // Convert to tree format
      return Object.entries(grouped).map(([location, devices]) => ({
        id: location,
        name: location,
        children: devices.map((device) => ({
          id: device.id,
          name: device.type,
        })),
      }))
    },
  })
}

export function useUpdateDevice() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: { id: string; power: number }) => {
      const command = data.power === 0 ? "off" : "on"
      return controlDevice(data.id, command as "on" | "off")
    },
    onSuccess: () => {
      // Invalidate the devices query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ["devices"] })
    },
  })
}
