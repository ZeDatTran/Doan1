import { useQuery, useMutation } from "@tanstack/react-query"
import { apiCall, queryClient } from "@/lib/api-client"

export interface Device {
  id: string
  name: string
  areaId: string
  groupId: string
  power: number
  status: "online" | "offline"
  lastUpdate: string
}

export function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: () => apiCall<Device[]>("/devices"),
  })
}

export function useDeviceTree() {
  return useQuery({
    queryKey: ["devices", "tree"],
    queryFn: () => apiCall<any>("/devices/tree"),
  })
}

export function useUpdateDevice() {
  return useMutation({
    mutationFn: (data: { id: string; power: number }) =>
      apiCall(`/devices/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] })
    },
  })
}
