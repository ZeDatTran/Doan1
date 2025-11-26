import { useQuery, useMutation } from "@tanstack/react-query"
import { apiCall, queryClient } from "@/lib/api-client"

export interface Schedule {
  id: string
  name: string
  targetId: string
  action: "on" | "off"
  time: string
  days: string[]
  enabled: boolean
  createdAt: string
}

export function useSchedules() {
  return useQuery({
    queryKey: ["schedules"],
    queryFn: () => apiCall<Schedule[]>("/schedules"),
  })
}

export function useCreateSchedule() {
  return useMutation({
    mutationFn: (data: Omit<Schedule, "id" | "createdAt">) =>
      apiCall("/schedules", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
    },
  })
}

export function useUpdateSchedule() {
  return useMutation({
    mutationFn: (data: Schedule) =>
      apiCall(`/schedules/${data.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
    },
  })
}

export function useDeleteSchedule() {
  return useMutation({
    mutationFn: (id: string) => apiCall(`/schedules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
    },
  })
}
